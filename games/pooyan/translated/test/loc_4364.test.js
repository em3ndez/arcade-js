// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_4364 (ROM 0x4364, Pooyan) -- an object state handler. While the
 * (ix+0x11) phase timer is nonzero it counts it down and returns; once zero it ticks loc_4006, calls
 * loc_3fd5 (carry return -> abort via ret c), else tails into loc_3553.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 desyncs the stack and the final pop misses CALLER_RET. loc_3fd5's carry contract is
 * modelled from m.retCarry (the routine's ret c depends on it). Paths: TIMER (timer>0 -> dec+ret),
 * RUN (timer 0, no carry -> tail loc_3553), ABORT (timer 0, carry -> ret c). MUTATION: mis-charge
 * `dec (ix+0x11)` (23 T) as 11 T -> the 63-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_4364.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4364 } from "../loc_4364.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4364, pcSeq: [], retCarry: false,
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack. loc_3fd5's net carry (abort signal) is modelled from m.retCarry.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x3fd5) { if (this.retCarry) regs.f |= 0x01; else regs.f &= ~0x01; }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_4364 TIMER: (ix+0x11) nonzero -> decrement and ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x05);

  loc_4364(m);

  assert.equal(m.tstates, 19 + 4 + 7 + 23 + 10, "TIMER path T-state total");
  assert.deepEqual(m.pcSeq, [0x4367, 0x4368, 0x436a, 0x436d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x436d to the seated caller");
  assert.deepEqual(m.calls, [], "no work while the timer runs");
  assert.equal(m.mem.read8(IX + 0x11), 0x04, "timer decremented 0x05 -> 0x04");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4364 RUN: timer 0, loc_3fd5 clears carry -> tail loc_3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x00);
  m.retCarry = false;

  loc_4364(m);

  assert.equal(m.tstates, 19 + 4 + 12 + 17 + 17 + 5 + 10, "RUN path T-state total (84)");
  assert.deepEqual(m.pcSeq, [0x4367, 0x4368, 0x436e, 0x4006, 0x3fd5, 0x4375, 0x3553]);
  assert.equal(m.pc, 0x3553, "tail jp lands on loc_3553");
  assert.deepEqual(m.calls, [0x4006, 0x3fd5, 0x3553]);
  // Tail jp: loc_3553's ret pops the seated CALLER_RET, so SP fully unwinds to the pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_4364 ABORT: timer 0, loc_3fd5 sets carry -> ret c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x00);
  m.retCarry = true;

  loc_4364(m);

  assert.equal(m.tstates, 19 + 4 + 12 + 17 + 17 + 11, "ABORT path T-state total (80)");
  assert.deepEqual(m.pcSeq, [0x4367, 0x4368, 0x436e, 0x4006, 0x3fd5, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret c at 0x4374 to the seated caller");
  assert.deepEqual(m.calls, [0x4006, 0x3fd5], "no tail into loc_3553");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4364 MUTATION: `dec (ix+0x11)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x436d ? 11 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x05);

  loc_4364(m);

  assert.equal(m.tstates, 51, "mutation loses 12 T (23 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 63, "TIMER path T-state total"),
    /63/,
    "the 63-T golden must fail on the mutant",
  );
});
