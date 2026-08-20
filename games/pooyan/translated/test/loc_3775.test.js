// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3775 (ROM 0x3775, Pooyan) -- end-of-move dispatch. Phase (0x880a)==5:
 * finish the slot only when the counter (ix+6)==0 (tail-jp 0x3553), else ret. Otherwise, once (ix+6)<2,
 * clear (ix+8) and pick the turn-around anim (0x3829/0x3847 per (ix+7) bit1), then tail-jp 0x381e;
 * (ix+6)>=2 rets.
 *
 * loc_3775 has no `call`/push16 -- it exits via two `ret cc` and two tail `jp`. The mock's `call` POPS,
 * modelling the tail callee's `ret` consuming the seated CALLER_RET, so tail exits unwind SP to baseline;
 * `ret cc` exits pop it directly.
 *
 * Paths: Q1 (==5, counter!=0 -> ret nz), Q2 (==5, counter==0 -> jp 0x3553), Q3 (!=5, (ix+6)>=2 ->
 * ret nc), Q4 (!=5, (ix+6)<2, bit1 clear -> DE=0x3829, jp 0x381e), Q5 (!=5, (ix+6)<2, bit1 set ->
 * DE=0x3847, jp 0x381e). MUTATION: `bit 1,(ix+7)` (20 T) mis-charged 8 T -> the 129-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_3775.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3775 } from "../loc_3775.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3775, pcSeq: [],
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

test("loc_3775 Q1: phase 5, counter != 0 -> ret nz at 0x3799", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0x880a, 0x05);
  m.mem.write8(0xa006, 0x03); // counter != 0

  loc_3775(m);

  assert.equal(m.tstates, 66, "Q1 T-state total");
  assert.deepEqual(m.pcSeq, [0x3778, 0x377a, 0x3795, 0x3798, 0x3799, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret unwinds SP to baseline");
});

test("loc_3775 Q2: phase 5, counter == 0 -> tail jp 0x3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0x880a, 0x05);
  m.mem.write8(0xa006, 0x00); // counter == 0

  loc_3775(m);

  assert.equal(m.tstates, 70, "Q2 T-state total");
  assert.deepEqual(m.pcSeq, [0x3778, 0x377a, 0x3795, 0x3798, 0x3799, 0x379a, 0x3553]);
  assert.equal(m.pc, 0x3553);
  assert.deepEqual(m.calls, [0x3553]);
  assert.equal(m.regs.sp, 0x8780, "tail exit unwinds SP to baseline");
});

test("loc_3775 Q3: phase != 5, (ix+6) >= 2 -> ret nc at 0x3781", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0x880a, 0x00); // != 5
  m.mem.write8(0xa006, 0x02); // >= 2

  loc_3775(m);

  assert.equal(m.tstates, 64, "Q3 T-state total");
  assert.deepEqual(m.pcSeq, [0x3778, 0x377a, 0x377c, 0x377f, 0x3781, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret unwinds SP to baseline");
});

test("loc_3775 Q4: phase != 5, (ix+6) < 2, bit1 clear -> DE=0x3829, jp 0x381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0x880a, 0x00);
  m.mem.write8(0xa006, 0x01); // < 2
  m.mem.write8(0xa007, 0x00); // bit1 clear
  m.mem.write8(0xa008, 0xaa); // must be cleared

  loc_3775(m);

  assert.equal(m.tstates, 129, "Q4 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3778, 0x377a, 0x377c, 0x377f, 0x3781, 0x3782, 0x3786, 0x3789, 0x378d, 0x3792, 0x381e,
  ]);
  assert.equal(m.mem.read8(0xa008), 0x00, "(ix+8) cleared");
  assert.equal(m.regs.de, 0x3829, "DE = 0x3829 (bit1 clear)");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.regs.sp, 0x8780, "tail exit unwinds SP to baseline");
});

test("loc_3775 Q5: phase != 5, (ix+6) < 2, bit1 set -> DE=0x3847, jp 0x381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0x880a, 0x00);
  m.mem.write8(0xa006, 0x00); // < 2
  m.mem.write8(0xa007, 0x02); // bit1 set

  loc_3775(m);

  assert.equal(m.tstates, 134, "Q5 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3778, 0x377a, 0x377c, 0x377f, 0x3781, 0x3782, 0x3786, 0x3789, 0x378d, 0x378f, 0x3792, 0x381e,
  ]);
  assert.equal(m.regs.de, 0x3847, "DE = 0x3847 (bit1 set)");
  assert.equal(m.pc, 0x381e);
  assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.regs.sp, 0x8780, "tail exit unwinds SP to baseline");
});

test("loc_3775 MUTATION: `bit 1,(ix+7)` mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x378d ? 8 : cycles);
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0x880a, 0x00);
  m.mem.write8(0xa006, 0x01);
  m.mem.write8(0xa007, 0x00);

  loc_3775(m);

  assert.equal(m.tstates, 117, "mutation loses 12 T (20 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 129, "Q4 T-state total"),
    /129/,
    "the 129-T golden must fail on the mutant",
  );
});
