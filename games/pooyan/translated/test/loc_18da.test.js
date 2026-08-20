// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_18da (ROM 0x18da, Pooyan) -- the pending-bonus / score-tally step.
 * (0x8909) holds a queued award; zero -> reload the queue slot and return; non-zero -> gate on the
 * active player's counter MSB, then bump 0x8908, BCD-step the queue, and run two sub-handlers.
 *
 * The mock's `call` POPS the return address the call site pushed. loc_18da's two calls (0x03c2, 0x0f0d)
 * sit just before the ret, so a missing push16 desyncs SP and the ret pops garbage -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_18da.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_18da } from "../loc_18da.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x18da, pcSeq: [],
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
}

// Path FULL: queued MSB (0x50) reached in player-1 counter -> bump 0x8908, step 0x08 (demo flag 0),
// BCD-add into the queue (0x58), run both sub-handlers, ret.
function setupFull(m) {
  seatCaller(m);
  m.mem.write8(0x8909, 0x50);  // queued award, non-zero
  m.mem.write8(0x880d, 0x00);  // player 1 -> HL=0x88a4
  m.mem.write8(0x88a4, 0x50);  // counter MSB == queued -> cp c gives Z
  m.mem.write8(0x8908, 0x00);  // saturating counter, < 0xff -> inc
  m.mem.write8(0x8800, 0x00);  // demo flag 0 -> step 0x08
}

const PC_FULL = [
  0x18dd, 0x18de, 0x18e0, 0x18e1, 0x18e4, 0x18e7, 0x18e8, 0x18ed, 0x18ee, 0x18ef,
  0x18f0, 0x18f3, 0x18f4, 0x18f6, 0x18f8, 0x18f9, 0x18fc, 0x18fd, 0x18ff, 0x1902,
  0x1903, 0x1904, 0x1907, 0x03c2, 0x0f0d, CALLER_RET,
];

test("loc_18da Path FULL: MSB reached -> bump, BCD step, two sub-handlers, ret", () => {
  const m = makeMachine();
  setupFull(m);

  loc_18da(m);

  assert.equal(m.tstates, 226, "Path FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x03c2, 0x0f0d], "both sub-handlers invoked");
  assert.equal(m.mem.read8(0x8908), 0x01, "saturating counter bumped");
  assert.equal(m.mem.read8(0x8909), 0x58, "queue BCD-stepped: 0x50 + 0x08");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_18da Path EMPTY: queue zero, demo flag 0 -> reload slot with 0x05, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8909, 0x00);  // queue empty -> jr z
  m.mem.write8(0x8800, 0x00);  // demo flag 0 -> A stays 0x05

  loc_18da(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 13 + 4 + 7 + 12 + 13 + 10, "Path EMPTY T total");
  assert.deepEqual(m.pcSeq, [
    0x18dd, 0x18de, 0x190e, 0x1911, 0x1912, 0x1914, 0x1918, 0x191b, CALLER_RET,
  ], "queue-empty reload branch");
  assert.deepEqual(m.calls, [], "no sub-handlers on the reload branch");
  assert.equal(m.mem.read8(0x8909), 0x05, "queue slot reloaded with 0x05");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack balanced (no calls, ret pops the seated caller)");
});

test("loc_18da Path EMPTY2: queue zero, demo flag non-zero -> reload slot with 0x03", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8909, 0x00);
  m.mem.write8(0x8800, 0x01);  // non-zero -> A becomes 0x03

  loc_18da(m);

  assert.deepEqual(m.pcSeq, [
    0x18dd, 0x18de, 0x190e, 0x1911, 0x1912, 0x1914, 0x1916, 0x1918, 0x191b, CALLER_RET,
  ], "jr z not taken -> ld a,0x03");
  assert.equal(m.mem.read8(0x8909), 0x03, "queue slot reloaded with 0x03");
});

test("loc_18da Path MISMATCH: counter MSB != queued -> ret nz, no writes", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8909, 0x50);
  m.mem.write8(0x880d, 0x00);  // player 1
  m.mem.write8(0x88a4, 0x40);  // MSB below queued -> cp c gives NZ

  loc_18da(m);

  assert.equal(m.tstates, 13 + 4 + 7 + 4 + 13 + 10 + 4 + 12 + 7 + 4 + 11, "Path MISMATCH T total");
  assert.deepEqual(m.pcSeq, [
    0x18dd, 0x18de, 0x18e0, 0x18e1, 0x18e4, 0x18e7, 0x18e8, 0x18ed, 0x18ee, 0x18ef, CALLER_RET,
  ], "ret nz at 0x18ef");
  assert.deepEqual(m.calls, [], "no work done");
  assert.equal(m.mem.read8(0x8909), 0x50, "queue untouched");
});

test("loc_18da Path P2: player-2 counter (0x880d bit0=1) uses HL=0x88a7", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8909, 0x11);
  m.mem.write8(0x880d, 0x01);  // player 2 -> HL=0x88a7
  m.mem.write8(0x88a4, 0x00);  // P1 slot must NOT be the one read
  m.mem.write8(0x88a7, 0x11);  // P2 MSB == queued
  m.mem.write8(0x8908, 0xff);  // already saturated -> jr nc, no inc
  m.mem.write8(0x8800, 0x00);  // step 0x08

  loc_18da(m);

  assert.deepEqual(m.pcSeq, [
    0x18dd, 0x18de, 0x18e0, 0x18e1, 0x18e4, 0x18e7, 0x18e8, 0x18ea, 0x18ed, 0x18ee, 0x18ef,
    0x18f0, 0x18f3, 0x18f4, 0x18f6, 0x18f9, 0x18fc, 0x18fd, 0x18ff, 0x1902,
    0x1903, 0x1904, 0x1907, 0x03c2, 0x0f0d, CALLER_RET,
  ], "player-2 HL load (0x18ea) + jr nc skips inc (0x18f8 absent)");
  assert.equal(m.mem.read8(0x8908), 0xff, "saturating counter left at 0xff");
  assert.equal(m.mem.read8(0x8909), 0x19, "queue BCD-stepped: 0x11 + 0x08");
});

test("loc_18da MUTATION: `ld a,(0x8909)` mis-charged 12T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x18dd ? 12 : cycles);
  setupFull(m);

  loc_18da(m);

  assert.equal(m.tstates, 225, "mutation loses 1 T");
  assert.throws(
    () => assert.equal(m.tstates, 226, "Path FULL T-state total"),
    /226/,
    "the 226-T golden must fail on the mutant",
  );
});
