// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_33bd (ROM 0x33bd, Pooyan) -- enemy actor state-0 handler.
 * Counts down (ix+0x11); on expiry advances (ix+0x02) and either runs the 0x33f7 flap-reset arm
 * (bit0 of (ix+0x0b) set) or falls into the loc_33ca tail (rst 0x20 0x3418-table lookup) that
 * tails to loc_381e or loc_3473. Carry survives the `ld a,0`/`ld de,nn` pair, so the 0x33e0 jr nc
 * reads the 0x33d6 `cp (ix+0x06)` carry -- the tests seat that ordering.
 *
 * The mock's `call` POPS the seated return so a missing push16 desyncs SP (the balance tooth): the
 * rst 0x20 pushes 0x33d3 (balanced by the pop) and each tail's loc_XXX ret pops the seated
 * CALLER_RET, returning SP to the pre-seat baseline. TEETH: `cp (ix+0x06)` (19T) mis-charged 7T is
 * caught by the T4 golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_33bd.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_33bd } from "../loc_33bd.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x33bd, pcSeq: [],
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

test("loc_33bd T1: timer not expired -> ret nz at 0x33c0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x02); // dec -> 1 -> NZ

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [0x33c0, CALLER_RET], "T1 boundaries");
  assert.equal(m.tstates, 34, "T1 T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x11), 0x01, "timer decremented");
});

test("loc_33bd T2: flap-reset (bit0 set), (ix+8) bit0 clear -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01); // dec -> 0 -> Z, ret nz not taken
  m.mem.write8(IX + 0x0b, 0x01); // bit0 set -> jr nz taken -> 0x33f7
  m.mem.write8(IX + 0x08, 0x00); // bit0 clear -> jr z,0x33e9 taken

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [
    0x33c0, 0x33c1, 0x33c4, 0x33c8, 0x33f7, 0x33fa, 0x33fb, 0x33fd, 0x3400, 0x3401,
    0x3404, 0x3407, 0x33ca, 0x340d, 0x3411, 0x33e9, 0x381e,
  ], "T2 boundaries");
  assert.equal(m.tstates, 229, "T2 T-total");
  assert.equal(m.pc, 0x381e, "tail into loc_381e");
  assert.deepEqual(m.calls, [0x33ca, 0x381e], "call loc_33ca then the tail");
  assert.equal(m.regs.sp, 0x8780, "call 0x33ca balanced; tail pops seated CALLER_RET");
  assert.equal(m.mem.read8(0x8901), 0x06, "0x8901 latched to 6");
  assert.equal(m.mem.read8(0x8d4a), 0x00, "0x8d4a cleared");
  assert.equal(m.mem.read8(IX + 0x0b), 0x00, "(ix+0x0b) cleared");
  assert.equal(m.mem.read8(0x8d4c), 0x01, "0x8d4c bumped");
});

test("loc_33bd T3: flap-reset, (ix+8) bit0 set -> ld de,0x3856 -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x0b, 0x01);
  m.mem.write8(IX + 0x08, 0x01); // bit0 set -> jr z not taken

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [
    0x33c0, 0x33c1, 0x33c4, 0x33c8, 0x33f7, 0x33fa, 0x33fb, 0x33fd, 0x3400, 0x3401,
    0x3404, 0x3407, 0x33ca, 0x340d, 0x3411, 0x3413, 0x3416, 0x33e9, 0x381e,
  ], "T3 boundaries");
  assert.equal(m.tstates, 246, "T3 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x33ca, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_33bd T4: fall-through, column == limit, (ix+9) >= (ix+5) -> jp loc_3473", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x0b, 0x00); // bit0 clear -> jr nz not taken -> 0x33ca tail
  m.mem.write8(0x8d43, 0x05); m.mem.write8(IX + 0x06, 0x05); // A&0x0f == (ix+6) -> Z
  m.mem.write8(IX + 0x09, 0x08); m.mem.write8(IX + 0x05, 0x05); // (ix+9) > (ix+5) -> NC

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [
    0x33c0, 0x33c1, 0x33c4, 0x33c8, 0x33ca, 0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6,
    0x33d9, 0x33ec, 0x33ef, 0x33f2, 0x33f4, 0x3473,
  ], "T4 boundaries");
  assert.equal(m.tstates, 218, "T4 T-total");
  assert.equal(m.pc, 0x3473, "tail into loc_3473");
  assert.deepEqual(m.calls, [0x0020, 0x3473], "rst 0x20 then the tail");
  assert.equal(m.regs.sp, 0x8780, "rst push16 balanced; tail pops seated CALLER_RET");
  assert.equal(m.mem.read8(0x8d4b), 0x05, "rst result latched to 0x8d4b");
});

test("loc_33bd T5: fall-through, column == limit, (ix+9) < (ix+5) -> back-branch -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x0b, 0x00);
  m.mem.write8(0x8d43, 0x04); m.mem.write8(IX + 0x06, 0x04); // Z
  m.mem.write8(IX + 0x09, 0x03); m.mem.write8(IX + 0x05, 0x08); // (ix+9) < (ix+5) -> C -> jr c,0x33e3

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [
    0x33c0, 0x33c1, 0x33c4, 0x33c8, 0x33ca, 0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6,
    0x33d9, 0x33ec, 0x33ef, 0x33f2, 0x33e3, 0x33e6, 0x33e9, 0x381e,
  ], "T5 boundaries (jr c back-branch into 0x33e3)");
  assert.equal(m.tstates, 252, "T5 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x08), 0x03, "(ix+8) stored from (ix+9)");
});

test("loc_33bd T6: fall-through, column > limit, jr nc taken -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x0b, 0x00);
  m.mem.write8(0x8d43, 0x07); m.mem.write8(IX + 0x06, 0x03); // A > (ix+6) -> NZ, NC -> jr z not taken, jr nc taken

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [
    0x33c0, 0x33c1, 0x33c4, 0x33c8, 0x33ca, 0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6,
    0x33d9, 0x33db, 0x33dd, 0x33e0, 0x33e6, 0x33e9, 0x381e,
  ], "T6 boundaries");
  assert.equal(m.tstates, 216, "T6 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "(ix+8) stored as 0");
});

test("loc_33bd T7: fall-through, column < limit, jr nc not taken -> inc a -> jp loc_381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x0b, 0x00);
  m.mem.write8(0x8d43, 0x02); m.mem.write8(IX + 0x06, 0x07); // A < (ix+6) -> NZ, C -> jr nc not taken

  loc_33bd(m);

  assert.deepEqual(m.pcSeq, [
    0x33c0, 0x33c1, 0x33c4, 0x33c8, 0x33ca, 0x33cd, 0x33cf, 0x33d2, 0x0020, 0x33d6,
    0x33d9, 0x33db, 0x33dd, 0x33e0, 0x33e2, 0x33e3, 0x33e6, 0x33e9, 0x381e,
  ], "T7 boundaries (inc a at 0x33e2)");
  assert.equal(m.tstates, 225, "T7 T-total");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x0020, 0x381e]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+8) stored as inc'd A");
});

test("loc_33bd MUTATION: `cp (ix+0x06)` mis-charged 7T (not 19T) is caught on T4", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x33d9 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01); m.mem.write8(IX + 0x0b, 0x00);
  m.mem.write8(0x8d43, 0x05); m.mem.write8(IX + 0x06, 0x05);
  m.mem.write8(IX + 0x09, 0x08); m.mem.write8(IX + 0x05, 0x05);

  loc_33bd(m);

  assert.equal(m.tstates, 206, "mutation loses 12 T");
  assert.throws(() => assert.equal(m.tstates, 218, "T4 golden"), /218/,
    "the 218-T golden must fail on the mutant");
});
