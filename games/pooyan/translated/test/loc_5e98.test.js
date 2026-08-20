// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5e98 (ROM 0x5e98, Pooyan) -- entry/dispatch of an actor sweep.
 * `ld a,i` selects the 0x8c90 (I==0) or 0x8ca8 (I!=0) pair; ret if its bit0 is clear; else latch the
 * pair at 0x8d65 and set up the B=4 / HL=0x8c30 / IX=0x8888 sweep, dispatching on the pair's bit1:
 * set -> tail-jump the 0x5f11 loop, clear -> fall through (tail) to the 0x5ebd loop body.
 *
 * The mock's `call` POPS: loc_5e98 makes no CALL, so both exits are TAIL delegations whose eventual
 * callee `ret` pops the seated CALLER_RET (the pop keeps SP balanced to the pre-seat baseline).
 *
 * Paths: INACTIVE (I==0, bit0 clear -> ret z), BIT1-SET (I!=0, bit0+bit1 set -> 0x5f11) and
 * BIT1-CLEAR (I!=0, bit0 set/bit1 clear -> 0x5ebd) cover both jr-z, both ret-z and both jr-nz outcomes.
 * TEETH: mis-charge `bit 1,(ix+0)` (20 T) as 4 T -> the golden total catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5e98.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5e98 } from "../loc_5e98.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5e98, pcSeq: [],
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
    // Tail delegation: the callee's ret pops the seated CALLER_RET (loc_5e98 reuses the frame).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5e98 Path INACTIVE: I==0 pair, bit0 clear -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x00;              // I==0 -> and a sets Z -> jr z keeps 0x8c90
  m.mem.write8(0x8c90, 0x00);  // bit0 clear -> ret z

  loc_5e98(m);

  assert.equal(m.tstates, 9 + 14 + 4 + 12 + 20 + 11, "Path INACTIVE total (=70)");
  assert.deepEqual(m.pcSeq, [0x5e9a, 0x5e9e, 0x5e9f, 0x5ea5, 0x5ea9, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret consumed CALLER_RET");
});

test("loc_5e98 Path BIT1-SET: I!=0 pair, bit0+bit1 set -> 0x5f11 loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x01;             // I!=0 -> jr z not taken -> pair 0x8ca8
  m.mem.write8(0x8ca8, 0x03);  // bit0 set (ret z not taken) + bit1 set (jr nz taken)

  loc_5e98(m);

  assert.equal(m.tstates, 9 + 14 + 4 + 7 + 14 + 20 + 5 + 20 + 20 + 14 + 7 + 10 + 12, "BIT1-SET total (=156)");
  assert.deepEqual(m.pcSeq, [
    0x5e9a, 0x5e9e, 0x5e9f, 0x5ea1, 0x5ea5, 0x5ea9, 0x5eaa, 0x5eae, 0x5eb2, 0x5eb6, 0x5eb8, 0x5ebb, 0x5f11,
  ]);
  assert.equal(m.pc, 0x5f11, "jr nz tail-jumps the 0x5f11 loop");
  assert.deepEqual(m.calls, [0x5f11]);
  assert.equal(m.mem.read16(0x8d65), 0x8ca8, "active pair latched at 0x8d65");
  assert.equal(m.regs.ix, 0x8888, "IX reloaded to the actor table");
  assert.equal(m.regs.b, 0x04, "B = 4 sweep count");
  assert.equal(m.regs.hl, 0x8c30, "HL = sweep base");
  assert.equal(m.regs.sp, 0x8780, "tail unwinds SP to baseline");
});

test("loc_5e98 Path BIT1-CLEAR: I!=0 pair, bit0 set / bit1 clear -> fall through to 0x5ebd", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x01;
  m.mem.write8(0x8ca8, 0x01);  // bit0 set (ret z not taken) + bit1 clear (jr nz not taken)

  loc_5e98(m);

  assert.equal(m.tstates, 9 + 14 + 4 + 7 + 14 + 20 + 5 + 20 + 20 + 14 + 7 + 10 + 7, "BIT1-CLEAR total (=151)");
  assert.deepEqual(m.pcSeq, [
    0x5e9a, 0x5e9e, 0x5e9f, 0x5ea1, 0x5ea5, 0x5ea9, 0x5eaa, 0x5eae, 0x5eb2, 0x5eb6, 0x5eb8, 0x5ebb, 0x5ebd,
  ]);
  assert.equal(m.pc, 0x5ebd, "fall through (tail) to the 0x5ebd loop body");
  assert.deepEqual(m.calls, [0x5ebd]);
  assert.equal(m.mem.read16(0x8d65), 0x8ca8, "active pair latched at 0x8d65");
  assert.equal(m.regs.sp, 0x8780, "tail unwinds SP to baseline");
});

test("loc_5e98 MUTATION: `bit 1,(ix+0)` mis-charged 4T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5eb2 ? 4 : cycles);
  seatCaller(m);
  m.regs.i = 0x01;
  m.mem.write8(0x8ca8, 0x03);

  loc_5e98(m);

  assert.equal(m.tstates, 140, "mutation loses 16 T (20 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 156, "BIT1-SET total"),
    /156/,
    "the 156-T golden must fail on the mutant",
  );
});
