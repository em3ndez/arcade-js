// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6aa8 (ROM 0x6aa8, Pooyan) -- state-1 object step, the rst-0x28
 * table[0] entry from loc_6a98. Runs loc_4006, subtracts speed (ix+9) from the 16-bit position
 * (ix+6):(ix+5) with a high-byte borrow; while (ix+6)!=0 it rets, else it clears (0x8f56) and
 * advances the state (ix+2) before returning to loc_6a98's caller.
 *
 * The mock's `call` POPS the pushed return (models the callee ret) = the stack tooth. Paths cover
 * the no-borrow ret-nz early exit, the borrow arm driving (ix+6) to 0 (advance), and the no-borrow
 * (ix+6)==0 advance; plus a dec-(ix+d) T-state mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_6aa8.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6aa8 } from "../loc_6aa8.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6aa8, pcSeq: [],
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

test("loc_6aa8 Path A: no borrow, (ix+6)!=0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x40); // (ix+5)
  m.mem.write8(0x9009, 0x10); // (ix+9); 0x40-0x10 no borrow
  m.mem.write8(0x9006, 0x05); // (ix+6) != 0

  loc_6aa8(m);

  assert.equal(m.tstates, 120, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [0x4006, 0x6aae, 0x6ab1, 0x6ab6, 0x6ab9, 0x6abc, 0x6abd, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x9005), 0x30, "(ix+5) = 0x40 - 0x10");
  assert.equal(m.mem.read8(0x9002), 0x00, "(ix+2) untouched on the early ret");
  assert.equal(m.mem.read8(0x8f56), 0x00, "(0x8f56) untouched on the early ret");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6aa8 Path B: borrow drives (ix+6) to 0 -> clear 0x8f56 + advance (ix+2)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x00);
  m.mem.write8(0x9009, 0x10); // 0x00-0x10 -> borrow, dec (ix+6)
  m.mem.write8(0x9006, 0x01); // -> 0x00

  loc_6aa8(m);

  assert.equal(m.tstates, 178, "Path B T-state total");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x6aae, 0x6ab1, 0x6ab3, 0x6ab6, 0x6ab9, 0x6abc, 0x6abd, 0x6abe, 0x6ac1, 0x6ac4, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x9005), 0xf0, "(ix+5) = 0x00 - 0x10");
  assert.equal(m.mem.read8(0x9006), 0x00, "(ix+6) borrow-decremented to 0");
  assert.equal(m.mem.read8(0x9002), 0x01, "(ix+2) advanced");
  assert.equal(m.mem.read8(0x8f56), 0x00, "(0x8f56) cleared");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6aa8 Path C: no borrow, (ix+6) already 0 -> clear 0x8f56 + advance", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x40);
  m.mem.write8(0x9009, 0x10); // no borrow
  m.mem.write8(0x9006, 0x00); // already 0

  loc_6aa8(m);

  assert.equal(m.tstates, 160, "Path C T-state total");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x6aae, 0x6ab1, 0x6ab6, 0x6ab9, 0x6abc, 0x6abd, 0x6abe, 0x6ac1, 0x6ac4, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x9002), 0x01, "(ix+2) advanced");
  assert.equal(m.mem.read8(0x8f56), 0x00, "(0x8f56) cleared");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6aa8 MUTATION: dec (ix+6) mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let firstAb6 = true;
  m.step = (nextAddr, cycles) => {
    // the borrow arm's dec (ix+6) is the FIRST step to 0x6ab6 (23T); a jr-nc-taken also lands 0x6ab6
    if (nextAddr === 0x6ab6 && firstAb6) { firstAb6 = false; return realStep(nextAddr, 19); }
    return realStep(nextAddr, cycles);
  };
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x00);
  m.mem.write8(0x9009, 0x10); // borrow arm -> dec (ix+6) is the mischarged step
  m.mem.write8(0x9006, 0x01);

  loc_6aa8(m);

  assert.equal(m.tstates, 174, "mutation loses 4 T");
  assert.throws(() => assert.equal(m.tstates, 178, "Path B T-state total"), /Path B/);
});
