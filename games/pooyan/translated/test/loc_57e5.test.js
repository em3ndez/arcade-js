// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_57e5 (ROM 0x57e5, Pooyan) -- a pure leaf: A <- (BC),
 * dec the counter at (HL), stamp (ix+0x13)=0x01 and (ix+0x16)=0xc1, ret. No calls.
 *
 * One straight-line path. We assert the A load from (BC), the dec8 result + Z flag at (HL)
 * (proves dec8 is wired, not a plain decrement), both ix-relative writes, the full pcSeq,
 * T=66, and that the ret unwinds to the seated caller (sp back to baseline).
 * TEETH: mis-charge `dec (hl)` (11 T) as 7 T -> the 66-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_57e5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_57e5 } from "../loc_57e5.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x57e5, pcSeq: [],
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
    // No calls in this routine, but keep the popping-mock shape for consistency.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function setup(m) {
  seatCaller(m);
  m.regs.bc = 0x9000; m.mem.write8(0x9000, 0x42); // A <- (BC)
  m.regs.hl = 0x9100; m.mem.write8(0x9100, 0x01); // dec (HL): 0x01 -> 0x00, Z set
  m.regs.ix = 0x8b00;                             // writes land at 0x8b13 / 0x8b16
  m.regs.f = 0x00;
}

test("loc_57e5: A<-(BC), dec (HL), stamp ix+0x13/ix+0x16, ret", () => {
  const m = makeMachine();
  setup(m);

  loc_57e5(m);

  assert.equal(m.tstates, 66, "T = 7 + 11 + 19 + 19 + 10");
  assert.deepEqual(m.pcSeq, [0x57e6, 0x57e7, 0x57eb, 0x57ef, CALLER_RET], "step boundaries");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.regs.a, 0x42, "A loaded from (BC)");
  assert.equal(m.mem.read8(0x9100), 0x00, "(HL) decremented 0x01 -> 0x00");
  assert.equal(m.regs.fZ, true, "dec8 set Z (proves dec8 wired, not plain decrement)");
  assert.equal(m.mem.read8(0x8b13), 0x01, "(ix+0x13) = 0x01");
  assert.equal(m.mem.read8(0x8b16), 0xc1, "(ix+0x16) = 0xc1");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_57e5 MUTATION: `dec (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x57e7 ? 7 : cycles);
  setup(m);

  loc_57e5(m);

  assert.equal(m.tstates, 62, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 66, "T-state total"),
    /66/,
    "the 66-T golden must fail on the mutant",
  );
});
