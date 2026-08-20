// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_34c9 (ROM 0x34c9, Pooyan) -- render the two-digit value at 0x8901
 * into VRAM (0x8743 low nibble, 0x8763 high nibble). Leaf routine (no calls).
 *
 * Paths:
 *  - LOW (value < 10, jr c at 0x34d5 taken): B kept, low nibble stored, high nibble 0 -> ret z at 0x34ef.
 *  - RETNZ (value >= 10, 0x8f50 nonzero): early `ret nz` at 0x34db.
 *  - HIGH (value >= 10, 0x8f50 == 0): BCD-convert loop, both nibbles stored, ret at 0x34f1.
 * Full pcSeq + T-state golden per path. MUTATION tooth: `add hl,de` (11T) mis-charged 7T is caught.
 * No push16 in this leaf, so the "delete a push16" positive control is N/A here; the mutation tooth
 * and the ret-to-caller assertion are the falsification controls.
 *
 * Run: node --test games/pooyan/translated/test/loc_34c9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_34c9 } from "../loc_34c9.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x34c9, pcSeq: [],
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

test("loc_34c9 LOW: value < 10 -> single digit, ret z at 0x34ef", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x07);

  loc_34c9(m);

  assert.equal(m.tstates, 123, "LOW T-state total");
  assert.deepEqual(m.pcSeq, [
    0x34cc, 0x34cd, 0x34d0, 0x34d3, 0x34d5, 0x34e3, 0x34e5, 0x34e6, 0x34e7,
    0x34e8, 0x34e9, 0x34ea, 0x34eb, 0x34ec, 0x34ee, 0x34ef, CALLER_RET,
  ], "LOW pcSeq");
  assert.equal(m.pc, CALLER_RET, "ret z returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
  assert.equal(m.mem.read8(0x8743), 0x07, "low nibble stored");
  assert.equal(m.mem.read8(0x8763), 0x00, "high nibble tile suppressed (ret z)");
  assert.equal(m.regs.hl, 0x8763, "HL advanced by 0x20");
  assert.equal(m.regs.b, 0x07, "B keeps the raw value on the < 10 path");
});

test("loc_34c9 RETNZ: value >= 10 and 0x8f50 nonzero -> ret nz at 0x34db", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x15);
  m.mem.write8(0x8f50, 0x01);

  loc_34c9(m);

  assert.equal(m.tstates, 79, "RETNZ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x34cc, 0x34cd, 0x34d0, 0x34d3, 0x34d5, 0x34d7, 0x34da, 0x34db, CALLER_RET,
  ], "RETNZ pcSeq");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.equal(m.mem.read8(0x8743), 0x00, "no render on the gated path");
});

test("loc_34c9 HIGH: value >= 10, gate open -> BCD convert, both nibbles stored", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x0a);  // 10 -> tens digit present
  m.mem.write8(0x8f50, 0x00);  // gate open

  loc_34c9(m);

  const daaLoop = [0x34dd];
  for (let i = 0; i < 9; i++) daaLoop.push(0x34df, 0x34e0, 0x34dd);
  daaLoop.push(0x34df, 0x34e0, 0x34e2);
  const expected = [
    0x34cc, 0x34cd, 0x34d0, 0x34d3, 0x34d5, 0x34d7, 0x34da, 0x34db, 0x34dc,
    ...daaLoop,
    0x34e3, 0x34e5, 0x34e6, 0x34e7, 0x34e8, 0x34e9, 0x34ea, 0x34eb, 0x34ec,
    0x34ee, 0x34ef, 0x34f0, 0x34f1, CALLER_RET,
  ];

  assert.equal(m.tstates, 394, "HIGH T-state total");
  assert.deepEqual(m.pcSeq, expected, "HIGH pcSeq (10-iter BCD loop)");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.equal(m.mem.read8(0x8743), 0x00, "low nibble of BCD 0x10");
  assert.equal(m.mem.read8(0x8763), 0x01, "high nibble of BCD 0x10");
  assert.equal(m.regs.b, 0x10, "B = BCD value 0x10");
});

test("loc_34c9 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x34e7 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8901, 0x07);

  loc_34c9(m);

  assert.equal(m.tstates, 119, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 123, "LOW T-state total"),
    /123/,
    "the 123-T golden must fail on the mutant",
  );
});
