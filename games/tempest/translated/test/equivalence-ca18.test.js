// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ca18 (ROM 0xca18-0xca37) -- masks $05 &= 0x3f, loads a fixed init block, rts.
// Run: node --test games/tempest/translated/test/equivalence-ca18.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ca18 } from "../loc_ca18.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("masks $05 and loads the fixed init block, no calls, rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x05] = 0xff;              // & 0x3f -> 0x3f
  loc_ca18(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x05], 0x3f, "$05 masked to low 6 bits");
  assert.equal(m.ram[0x3e], 0x00);
  assert.equal(m.ram[0x02], 0x1a);
  assert.equal(m.ram[0x00], 0x0a);
  assert.equal(m.ram[0x04], 0xa0);
  assert.equal(m.ram[0x016b], 0x01);
  assert.equal(m.ram[0x01], 0x0a);
  assert.equal(m.regs.a, 0x0a, "last lda leaves 0x0a in A");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 45);
});

test("mask keeps low 6 bits of an arbitrary $05", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x05] = 0xa5;              // 1010_0101 & 0x3f -> 0x25
  loc_ca18(m);
  assert.equal(m.ram[0x05], 0x25);
  assert.equal(m.cycles, 45);
});
