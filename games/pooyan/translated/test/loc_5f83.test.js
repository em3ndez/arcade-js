// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f83 (ROM 0x5f83, Pooyan) -- picks the active object record
 * (0x8c90, or 0x8ca8 when I!=0), reads its type byte, `ret z` on type 0, else latches the type and
 * FALLS THROUGH into loc_5fa2. The fall-through is a tail (no push16): loc_5fa2's eventual ret consumes
 * the seated caller frame, so the mock's `call` pops once and the stack returns to the pre-seat baseline.
 *
 * Path P1 (I==0, type!=0): jr z picks 0x8c90, ret z not taken, latch 0x8d44/C/IX/B/HL, tail loc_5fa2.
 * Path P2 (I!=0, type==0): jr z not taken -> IX=0x8ca8, ret z returns to the caller.
 * TEETH: mis-charge `ld a,(ix+0)` (19 T) as 15 T -> the 115-T P1 golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5f83.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f83 } from "../loc_5f83.js";

const CALLER_RET = 0xabcd;
const BASELINE = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f83, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The tail fall-through into loc_5fa2 pushes NO return; loc_5fa2 eventually rets and consumes the
    // seated caller frame -- model that with a single pop so SP unwinds to the pre-seat baseline.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = BASELINE;
  m.push16(CALLER_RET);
}

test("loc_5f83 Path P1: I==0 picks 0x8c90, type!=0 -> latch + tail into loc_5fa2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x00;              // ld a,i -> A=0 -> and a Z -> jr z picks 0x8c90
  m.regs.iff2 = 0;
  m.mem.write8(0x8c90, 0x05);   // type byte nonzero -> ret z not taken

  loc_5f83(m);

  assert.equal(m.tstates, 115, "Path P1 T total");
  assert.deepEqual(m.pcSeq, [
    0x5f87, 0x5f89, 0x5f8a, 0x5f90, 0x5f93, 0x5f94,
    0x5f95, 0x5f98, 0x5f99, 0x5f9d, 0x5f9f, 0x5fa2,
  ], "jr z picks 0x8c90; ret z not taken; tail steps into loc_5fa2");
  assert.equal(m.pc, 0x5fa2, "tail fall-through lands on loc_5fa2");
  assert.deepEqual(m.calls, [0x5fa2], "tail call into loc_5fa2");
  assert.equal(m.mem.read8(0x8d44), 0x05, "type latched to 0x8d44");
  assert.equal(m.regs.c, 0x05, "type latched to C");
  assert.equal(m.regs.ix, 0x8850, "IX reset to the slot table base");
  assert.equal(m.regs.b, 0x06, "B = 6 slots");
  assert.equal(m.regs.hl, 0x8ae0, "HL = slot list base");
  assert.equal(m.regs.sp, BASELINE, "stack unwound to baseline via loc_5fa2's ret");
});

test("loc_5f83 Path P2: I!=0 picks 0x8ca8, type==0 -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x05;              // ld a,i -> A!=0 -> jr z not taken -> IX=0x8ca8
  m.regs.iff2 = 0;
  m.mem.write8(0x8ca8, 0x00);   // type 0 -> ret z

  loc_5f83(m);

  assert.equal(m.tstates, 82, "Path P2 T total");
  assert.deepEqual(m.pcSeq, [
    0x5f87, 0x5f89, 0x5f8a, 0x5f8c, 0x5f90, 0x5f93, 0x5f94, CALLER_RET,
  ], "jr z not taken -> IX=0x8ca8; ret z to caller");
  assert.equal(m.pc, CALLER_RET, "ret z returns to the seated caller");
  assert.deepEqual(m.calls, [], "no tail -- returned before the fall-through");
  assert.equal(m.regs.ix, 0x8ca8, "IX = second record base");
  assert.equal(m.mem.read8(0x8d44), 0x00, "no type latched");
  assert.equal(m.regs.sp, BASELINE, "stack unwound to baseline");
});

test("loc_5f83 MUTATION: `ld a,(ix+0)` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5f93 ? 15 : cycles);
  seatCaller(m);
  m.regs.i = 0x00;
  m.regs.iff2 = 0;
  m.mem.write8(0x8c90, 0x05);

  loc_5f83(m);

  assert.equal(m.tstates, 111, "mutation loses 4 T (19 -> 15)");
  assert.throws(
    () => assert.equal(m.tstates, 115, "Path P1 T total"),
    /115/,
    "the 115-T golden must fail on the mutant",
  );
});
