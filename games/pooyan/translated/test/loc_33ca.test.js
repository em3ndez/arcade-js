// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_33ca (ROM 0x33ca, Pooyan) -- second entry into loc_33bd's tail
 * (call target from 0x3407; loc_33bd also falls through here). The rst 0x20 (0x3418 table) lookup
 * latches 0x8d4b, then a branch on the masked column vs (ix+0x06)/(ix+0x05) tails to loc_381e
 * (storing (ix+0x08)) or loc_3473. Carry survives the `ld a,0`/`ld de,nn` pair so the 0x33e0 jr nc
 * reads the 0x33d6 `cp (ix+0x06)` carry.
 *
 * The mock's `call` POPS the seated return (the balance tooth): the rst 0x20 pushes 0x33d3
 * (balanced by the pop) and each tail's loc_XXX ret pops the seated CALLER_RET -> SP to the
 * pre-seat baseline. TEETH: `cp (ix+0x06)` (19T) mis-charged 7T is caught by the C1 golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_33ca.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_33ca } from "../loc_33ca.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x33ca, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_33ca C1: column == limit, (ix+9) >= (ix+5) -> jp loc_3473", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d43, 0x05); m.mem.write8(IX + 0x06, 0x05); // Z
  m.mem.write8(IX + 0x09, 0x08); m.mem.write8(IX + 0x05, 0x05); // NC -> jr c not taken

  loc_33ca(m);

  assert.deepEqual(m.pcSeq, [
    0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6, 0x33d9, 0x33ec, 0x33ef, 0x33f2, 0x33f4, 0x3473,
  ], "C1 boundaries");
  assert.equal(m.tstates, 140, "C1 T-total");
  assert.equal(m.pc, 0x3473, "tail into loc_3473");
  assert.deepEqual(m.calls, [0x0020, 0x3473], "rst 0x20 then the tail");
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(0x8d4b), 0x05, "rst result latched");
});

test("loc_33ca C2: column == limit, (ix+9) < (ix+5) -> back-branch -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d43, 0x04); m.mem.write8(IX + 0x06, 0x04); // Z
  m.mem.write8(IX + 0x09, 0x03); m.mem.write8(IX + 0x05, 0x08); // C -> jr c,0x33e3

  loc_33ca(m);

  assert.deepEqual(m.pcSeq, [
    0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6, 0x33d9, 0x33ec, 0x33ef, 0x33f2, 0x33e3,
    0x33e6, 0x33e9, 0x381e,
  ], "C2 boundaries (back-branch into 0x33e3)");
  assert.equal(m.tstates, 174, "C2 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x08), 0x03, "(ix+8) stored from (ix+9)");
});

test("loc_33ca C3: column > limit, jr nc taken -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d43, 0x07); m.mem.write8(IX + 0x06, 0x03); // NZ, NC

  loc_33ca(m);

  assert.deepEqual(m.pcSeq, [
    0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6, 0x33d9, 0x33db, 0x33dd, 0x33e0, 0x33e6, 0x33e9, 0x381e,
  ], "C3 boundaries");
  assert.equal(m.tstates, 138, "C3 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "(ix+8) stored as 0");
});

test("loc_33ca C4: column < limit, jr nc not taken -> inc a -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d43, 0x02); m.mem.write8(IX + 0x06, 0x07); // NZ, C

  loc_33ca(m);

  assert.deepEqual(m.pcSeq, [
    0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6, 0x33d9, 0x33db, 0x33dd, 0x33e0, 0x33e2,
    0x33e3, 0x33e6, 0x33e9, 0x381e,
  ], "C4 boundaries (inc a at 0x33e2)");
  assert.equal(m.tstates, 147, "C4 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+8) stored as inc'd A");
});

test("loc_33ca MUTATION: `cp (ix+0x06)` mis-charged 7T (not 19T) is caught on C1", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x33d9 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d43, 0x05); m.mem.write8(IX + 0x06, 0x05);
  m.mem.write8(IX + 0x09, 0x08); m.mem.write8(IX + 0x05, 0x05);

  loc_33ca(m);

  assert.equal(m.tstates, 128, "mutation loses 12 T");
  assert.throws(() => assert.equal(m.tstates, 140, "C1 golden"), /140/,
    "the 140-T golden must fail on the mutant");
});
