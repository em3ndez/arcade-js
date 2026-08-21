// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_69ad (ROM 0x69ad, Pooyan) -- steps 8 paired records through
 * loc_69c6, advancing ix (from 0x8ae0) and iy (from 0x8ba0) by stride 0x18 each iteration. exx
 * guards the loop count B and stride DE across the call; the mock's `call` POPS the pushed return
 * (the stack tooth) and does NOT run the callee, so ix/iy after 8 steps are pure loop arithmetic.
 * Asserts full pcSeq (8 iterations, last djnz fall-through), call list, T-state total, final ix/iy,
 * and SP balance, plus a T-state mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_69ad.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_69ad } from "../loc_69ad.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x69ad, pcSeq: [],
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

const SETUP = [0x69b1, 0x69b5, 0x69b8, 0x69ba];
const ITER = [0x69bb, 0x69c6, 0x69bf, 0x69c1, 0x69c3, 0x69ba]; // djnz taken -> back to 0x69ba
const LAST = [0x69bb, 0x69c6, 0x69bf, 0x69c1, 0x69c3, 0x69c5]; // djnz fall-through -> ret

test("loc_69ad: 8 paired steps through loc_69c6", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_69ad(m);

  const expected = [...SETUP];
  for (let i = 0; i < 7; i++) expected.push(...ITER);
  expected.push(...LAST, CALLER_RET);

  assert.deepEqual(m.pcSeq, expected);
  assert.deepEqual(m.calls, Array(8).fill(0x69c6));
  assert.equal(m.tstates, 594, "45 setup + 539 loop + 10 ret");
  assert.equal(m.regs.ix, 0x8ba0, "ix = 0x8ae0 + 8*0x18");
  assert.equal(m.regs.iy, 0x8c60, "iy = 0x8ba0 + 8*0x18");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_69ad MUTATION: add iy,de mis-charged 14T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x69c3 ? 14 : cycles);
  seatCaller(m);

  loc_69ad(m);

  assert.equal(m.tstates, 586, "mutation loses 1T on each of 8 add iy,de");
  assert.throws(() => assert.equal(m.tstates, 594), /594/);
});
