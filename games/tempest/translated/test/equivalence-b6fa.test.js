// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b6fa (ROM 0xb6fa-0xb71a) -- signed fixed-point scale of A by the low 3 bits
// of $02cc,x: 3 rounds of (lsr fraction -> optional add $29 -> asl/php/ror/plp/ror arithmetic >>1).
// Run: node --test games/tempest/translated/test/equivalence-b6fa.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b6fa } from "../loc_b6fa.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// fraction low3 == 0 -> bcc taken every round (carry clear, no add) -> result 0
test("fraction 0 -> bcc taken all 3 rounds -> A=0", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x10; m.regs.x = 0x00;
  m.ram[0x02cc] = 0x00;            // low3 = 0
  loc_b6fa(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0x00, "no add ever -> 0");
  assert.equal(m.regs.x, 0x00, "X restored from $2b");
  assert.equal(m.ram[0x29], 0x10, "arg saved to $29");
  assert.equal(m.ram[0x2c], 0x00, "fraction fully shifted out");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 105);
});

// fraction low3 == 7 -> bcc not taken every round (add $29 each round)
test("fraction 7 -> bcc not taken all 3 rounds -> A=0x0e", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x10; m.regs.x = 0x00;
  m.ram[0x02cc] = 0x07;
  loc_b6fa(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0x0e);
  assert.equal(m.ram[0x2c], 0x00);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 117);
});

// mixed fraction (5 = bits 0 and 2 set) exercises both branch directions across the 3 rounds
test("fraction 5, arg 0x7f -> mixed add/skip -> A=0xcf", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x7f; m.regs.x = 0x00;
  m.ram[0x02cc] = 0x05;
  loc_b6fa(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0xcf);
  assert.equal(m.ram[0x29], 0x7f);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 113);
});

// page-cross edge: x=0x34 pushes lda $02cc,x to $0300 (crosses page) -> +1 cycle; also proves X restore
test("edge: abs,x load $02cc,x page cross (+1) and X restored", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x10; m.regs.x = 0x34;
  m.ram[(0x02cc + 0x34) & 0xffff] = 0x00; // $0300, low3 = 0 -> result 0
  loc_b6fa(m);
  assert.equal(m.regs.a, 0x00);
  assert.equal(m.regs.x, 0x34, "X restored to the saved value, not #2");
  assert.equal(m.ram[0x2b], 0x34, "X stashed to $2b");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 106, "105 + 1 page cross");
});
