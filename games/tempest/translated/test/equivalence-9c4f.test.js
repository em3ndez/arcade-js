// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9c4f (ROM 0x9c4f-0x9c57) -- toggles bit $40 of $0283,x, stores back, rts.
// Run: node --test games/tempest/translated/test/equivalence-9c4f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9c4f } from "../loc_9c4f.js";

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

test("bit clear -> set: 0x00 ^ 0x40 = 0x40, N/Z from result, rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  loc_9c4f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0x40, "bit $40 set");
  assert.equal(m.regs.a, 0x40);
  assert.equal(m.regs.fZ, false, "result nonzero");
  assert.equal(m.regs.fN, false, "bit7 clear");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 17, "lda 4 + eor 2 + sta 5 + rts 6");
});

test("bit set -> clear: 0x40 ^ 0x40 = 0x00 -> Z set, low bits preserved", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x40;
  loc_9c4f(m);
  assert.equal(m.ram[0x0283], 0x00, "bit $40 cleared");
  assert.equal(m.regs.fZ, true, "result zero");
  assert.equal(m.cycles, 17);
});

test("other bits untouched, N set when bit7 present: 0x87 ^ 0x40 = 0xc7", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x87;
  loc_9c4f(m);
  assert.equal(m.ram[0x0283], 0xc7, "only $40 flipped");
  assert.equal(m.regs.fN, true, "bit7 set -> N");
  assert.equal(m.cycles, 17);
});

test("edge: abs,x load page cross adds +1 (store stays 5 fixed)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                 // 0x0283+0x80 = 0x0303 -> crosses into page 0x03
  m.ram[0x0303] = 0x00;
  loc_9c4f(m);
  assert.equal(m.ram[0x0303], 0x40, "toggled at indexed address");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 18, "lda 5 (cross) + eor 2 + sta 5 + rts 6");
});
