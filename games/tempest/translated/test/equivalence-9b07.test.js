// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9b07 (ROM 0x9b07) -- saves Y in $36; $29>=0x20 dispatches via loc_9a88, else
// Y=$2b and calls loc_9aee; restores Y from $36. JSR targets are opaque (recorded, return pulled).
// Run: node --test games/tempest/translated/test/equivalence-9b07.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9b07 } from "../loc_9b07.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_9b07: $29 >= 0x20 -> bcs -> jsr loc_9a88; Y restored; 29 T", () => {
  const m = makeMachine();
  m.regs.y = 0x77;
  m.regs.s = 0xfd;
  m.push16(0x3000); // final rts -> 0x3001
  m.ram[0x29] = 0x40; // >= 0x20 -> carry set at cmp
  m.ram[0x2b] = 0x55;
  m.ram[0x36] = 0x99; // will be overwritten by sty then read back by ldy
  loc_9b07(m);
  assert.equal(m.ram[0x36], 0x77, "sty $36 saved the incoming Y");
  assert.deepEqual(m.calls, [0x9a88], "$29>=0x20 -> dispatch loc_9a88");
  assert.equal(m.regs.y, 0x77, "ldy $36 restored Y");
  assert.equal(m.pc, 0x3001, "final rts -> pushed + 1");
  assert.equal(m.cycles, 29, "3+3+2+3+3(bcs)+6(jsr)+3(ldy)+6(rts)");
});

test("loc_9b07: $29 < 0x20 -> bcc fall -> Y=$2b, jsr loc_9aee; Y restored; 35 T", () => {
  const m = makeMachine();
  m.regs.y = 0x11;
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x29] = 0x1f; // < 0x20 -> carry clear at cmp
  m.ram[0x2b] = 0x55; // becomes Y for the loc_9aee call path
  loc_9b07(m);
  assert.equal(m.ram[0x36], 0x11, "sty $36 saved the incoming Y");
  assert.deepEqual(m.calls, [0x9aee], "$29<0x20 -> call loc_9aee");
  assert.equal(m.regs.y, 0x11, "ldy $36 restored Y after the call");
  assert.equal(m.pc, 0x3001, "final rts -> pushed + 1");
  assert.equal(m.cycles, 35, "3+3+2+3+2(bcc)+2(tay)+6(jsr)+2(clv)+3(bvc)+3(ldy)+6(rts)");
});
