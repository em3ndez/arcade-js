// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a463 (ROM 0xa463-0xa503). $2e = A (threshold); loops y=10..0 over the $02db
// table forming |val-$2e|, dispatching jsr a36f (low y) / jsr a309 / jsr a38e (high y) on a chain of
// $02b5/$02ad/$02c0/$02c8/$0151/$0202 compares; on exit clears $02d3,x/$02f2,x + dec $0135 iff
// $02f2,x==0xff. Minimal 6502 harness (records opaque JSRs; does not run them). The whole-machine
// boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-a463.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a463 } from "../loc_a463.js";

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

test("loc_a463: all $02db entries zero -> every iteration BEQ-skips; $02f2,x==0xff clears + dec $0135; 189 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000); // RTS -> 0x5001
  m.regs.a = 0x55;  // stored to $2e
  m.regs.x = 0x00;
  m.ram[0x02f2] = 0xff; // == 0xff -> clear branch
  m.ram[0x02d3] = 0x99;
  m.ram[0x0135] = 0x05;

  loc_a463(m);

  assert.equal(m.ram[0x2e], 0x55, "$2e = A");
  assert.equal(m.ram[0x02d3], 0x00, "$02d3,x cleared");
  assert.equal(m.ram[0x02f2], 0x00, "$02f2,x cleared");
  assert.equal(m.ram[0x0135], 0x04, "$0135 decremented");
  assert.equal(m.pc, 0x5001, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, [], "no dispatch calls on the all-zero table");
  // preamble(5) + 10*skip(14) + last-skip(12) + a4f1 lda(4)+cmp(2)+bne-nt(2) + lda#(2)+sta abs,x(5)+dec abs(6)+sta abs,x(5)+rts(6)
  assert.equal(m.cycles, 5 + 10 * 14 + 12 + 8 + 24, "189 T");
});

test("loc_a463: low-y match (y=0) -> jsr a36f; $02f2,x!=0xff -> BNE rts (no clear); 216 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.a = 0x30; // threshold $2e
  m.regs.x = 0x00;
  m.ram[0x02db] = 0x20; // y=0 table entry (V < T -> bcc taken, delta = 0x10)
  m.ram[0xa7] = 0x30;   // delta 0x10 < 0xa7-cell -> bcs not taken
  m.ram[0x02b5] = 0x07; // $02b5,0
  m.ram[0x02ad] = 0x07; // $02ad,x -> eor == 0 -> bne not taken -> jsr a36f
  m.ram[0x02f2] = 0x00; // != 0xff -> no clear

  loc_a463(m);

  assert.equal(m.ram[0x2e], 0x30, "$2e = threshold");
  assert.deepEqual(m.calls, [0xa36f], "low-y match dispatches jsr a36f");
  assert.equal(m.ram[0x02f2], 0x00, "$02f2,x untouched (was not 0xff)");
  assert.equal(m.ram[0x0135], 0x00, "$0135 untouched (no clear branch)");
  assert.equal(m.pc, 0x5001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 5 + 10 * 14 + 56 + 15, "216 T");
});

test("loc_a463: high-y (y=4, remap==4) -> jsr a309 via the cpy==4 chain; 260 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.a = 0x20; // threshold
  m.regs.x = 0x00;
  m.ram[0x02df] = 0x50; // y=4 entry (V >= T -> bcc not taken, delta 0x30)
  m.ram[0x0283] = 0x04; // $027f,4 -> and 7 = 4 -> tay y=4
  m.ram[0x0155] = 0x40; // $0151,4 -> A(0x30) < 0x40 -> bcs not taken
  m.ram[0x0202] = 0x11; // $02db,4 (0x50) != -> beq not taken
  m.ram[0x02ad] = 0x22; // $02ad,x
  m.ram[0x02b9] = 0x22; // $02b5,4 -> equal -> bne not taken
  m.ram[0x02cc] = 0x80; // $02c8,4 negative -> bpl not taken -> jsr a309
  m.ram[0x02f2] = 0x00;

  loc_a463(m);

  assert.deepEqual(m.calls, [0xa309], "cpy==4 chain dispatches jsr a309");
  assert.equal(m.pc, 0x5001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 5 + 6 * 14 + 102 + (3 * 14 + 12) + 15, "260 T");
});

test("loc_a463: high-y (y=5, remap!=4) -> jsr a38e via the a4c1 chain; 253 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x5000);
  m.regs.a = 0x20; // threshold
  m.regs.x = 0x00;
  m.ram[0x02e0] = 0x50; // y=5 entry (V >= T -> delta 0x30)
  m.ram[0x0284] = 0x02; // $027f,5 -> and 7 = 2 -> tay y=2 (!=4 -> bne a4c1)
  m.ram[0x0153] = 0x40; // $0151,2 -> A(0x30) < 0x40 -> bcs not taken
  m.ram[0x02cd] = 0x80; // $02c8,5 negative -> bpl not taken -> a4c8
  m.ram[0x02ba] = 0x33; // $02b5,5
  m.ram[0x02c0] = 0x33; // $02c0,x -> equal -> beq a4e2 -> jsr a38e
  m.ram[0x02f2] = 0x00;

  loc_a463(m);

  assert.deepEqual(m.calls, [0xa38e], "a4c1 chain dispatches jsr a38e");
  assert.equal(m.ram[0x37], 0x00, "stx $37 saved X across jsr a38e");
  assert.equal(m.pc, 0x5001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 5 + 5 * 14 + 95 + (4 * 14 + 12) + 15, "253 T");
});
