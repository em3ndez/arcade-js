// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a23f (ROM 0xa23f-0xa2a5). Minimal 6502 harness; JSR $ccea/$a463 opaque
// (recorded). Run: node --test games/tempest/translated/test/equivalence-a23f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a23f } from "../loc_a23f.js";

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

test("loc_a23f: $0201 negative -> BMI to rts; 13 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.ram[0x0201] = 0x80;
  loc_a23f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x1001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 3 + 6, "13 T");
});

test("loc_a23f: $05 negative, $4d & 0x10 == 0 -> BEQ to rts; 26 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.ram[0x0201] = 0x00; // non-neg
  m.ram[0x05] = 0x80;   // negative -> BMI a270
  m.ram[0x4d] = 0x00;   // & 0x10 = 0 -> BEQ a2a5
  loc_a23f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 2 + 3 + 3 + 3 + 2 + 3 + 6, "26 T");
});

test("loc_a23f: $05 non-neg, first-loop count stays 0 -> BEQ to rts; 168 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.ram[0x0201] = 0x00;
  m.ram[0x05] = 0x00;    // non-neg -> a248 path
  m.ram[0x0106] = 0x00;  // seed $29 = 0
  // all $02db,x zero -> loop1 always BEQ a268 (no inc $29); $29 stays 0 -> BEQ a2a5
  loc_a23f(m);
  assert.equal(m.ram[0x29], 0x00, "$29 count unchanged");
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x3001, "rts -> pushed+1");
  assert.equal(m.cycles, 168, "20 + 10*12 + 11 + 17");
});

test("loc_a23f: gated, second loop fills a free slot at X=7 -> jsr ccea+a463; 95 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x4000);
  m.ram[0x0201] = 0x00;
  m.ram[0x05] = 0x80;    // negative -> a270
  m.ram[0x4d] = 0x10;    // & 0x10 = 0x10 nonzero -> BEQ not taken
  m.ram[0x02d3 + 0x07] = 0x00; // $02da free -> bne not taken -> fill
  m.ram[0x0135] = 0x02;
  m.ram[0x0202] = 0x40;
  m.ram[0x0200] = 0x50;
  loc_a23f(m);
  assert.equal(m.ram[0x0135], 0x03, "$0135 incremented");
  assert.equal(m.ram[0x02d3 + 0x07], 0x40, "$02d3,x = $0202");
  assert.equal(m.ram[0x02ad + 0x07], 0x50, "$02ad,x = $0200");
  assert.equal(m.ram[0x02c0 + 0x07], 0x00, "$02c0,x = $0201");
  assert.equal(m.ram[0x02f2 + 0x07], 0x00, "$02f2,x = 0");
  assert.deepEqual(m.calls, [0xccea, 0xa463], "jsr ccea then a463");
  assert.equal(m.pc, 0x4001, "rts -> pushed+1");
  assert.equal(m.cycles, 95, "traced total");
});
