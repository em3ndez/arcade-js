// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9e2f (ROM 0x9e2f-0x9e47) -- per-slot guard chain that calls $a33a only when
// $0283,x >= 0 AND $02b9,x == $0200 AND $02cc,x == $0201. Run: node --test games/tempest/translated/test/equivalence-9e2f.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9e2f } from "../loc_9e2f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { this.calls.push(t); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("bmi taken: negative $0283,x bails straight to rts, no call", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00; m.mem.write8(0x0283, 0x80); // negative
  loc_9e2f(m);
  assert.deepEqual(m.calls, [], "no $a33a call");
  assert.equal(m.pc, 0x1235, "rts -> pushed return + 1");
  assert.equal(m.cycles, 4 + 3 + 6, "lda abs,x in-page 4 + bmi taken 3 + rts 6 = 13");
});

test("full match path -> jsr $a33a", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0283, 0x00);                 // positive -> bmi not taken
  m.mem.write8(0x02b9, 0x05); m.mem.write8(0x0200, 0x05); // equal -> bne not taken
  m.mem.write8(0x02cc, 0x07); m.mem.write8(0x0201, 0x07); // equal -> bne not taken
  loc_9e2f(m);
  assert.deepEqual(m.calls, [0xa33a], "calls $a33a exactly once");
  assert.equal(m.regs.a, 0x07, "A = last loaded $02cc,x");
  assert.equal(m.cycles, 4 + 2 + 4 + 4 + 2 + 4 + 4 + 2 + 6 + 6, "full chain + jsr + rts = 38");
});

test("first cmp mismatch: bne taken to rts, no call", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0283, 0x00);
  m.mem.write8(0x02b9, 0x05); m.mem.write8(0x0200, 0x06); // NOT equal -> bne taken
  loc_9e2f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x1235, "rts");
  assert.equal(m.cycles, 4 + 2 + 4 + 4 + 3 + 6, "= 23");
});

test("second cmp mismatch: bne taken to rts, no call", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x00;
  m.mem.write8(0x0283, 0x00);
  m.mem.write8(0x02b9, 0x05); m.mem.write8(0x0200, 0x05); // equal
  m.mem.write8(0x02cc, 0x07); m.mem.write8(0x0201, 0x08); // NOT equal -> bne taken
  loc_9e2f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 4 + 2 + 4 + 4 + 2 + 4 + 4 + 3 + 6, "= 33");
});

test("edge: abs,x page cross adds 1 cycle on the first load", () => {
  const m = makeMachine(); m.push16(0x1234);
  m.regs.x = 0x80;                            // 0x0283 + 0x80 = 0x0303 -> page cross
  m.mem.write8(0x0303, 0x80);                 // negative -> bmi taken
  loc_9e2f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 5 + 3 + 6, "lda abs,x cross 5 + bmi taken 3 + rts 6 = 14");
});
