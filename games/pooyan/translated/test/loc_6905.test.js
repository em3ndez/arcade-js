// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6905 (ROM 0x6905, Pooyan) -- (0x8929) delay-counter gate over an
 * 8-record update sweep. While (0x8929)!=0 it decrements and rets. On 0 it rets if (0x892d)==(0x8903)
 * or (0x892d)>=8, else walks 8 record pairs at ix=0x8ae0 / iy=0x8ba0 (0x18-byte stride), calling
 * loc_6931 on each; exx parks the loop counter B + stride DE in the shadow set across the call.
 *
 * The mock's `call` POPS the pushed return (models the callee ret); the stack tooth. loc_6931 is a
 * KNOWN unexecuted callee lifted faithfully. Paths cover: the timer-tick decrement; the two gate rets
 * ((0x892d)==(0x8903), (0x892d)>=8); the full 8-iteration sweep; and a per-iteration T-mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_6905.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6905 } from "../loc_6905.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6905, pcSeq: [],
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
    // model the callee's own ret: pop the pushed continuation into pc (a NORMAL return, e.g. loc_6931's
    // `ret c`). The skip-abort guard in loc_6905 reads m.pc, so the mock must set it or the guard sees
    // stale pc. A SPAWN (pop-af; ret) is modelled per-test by overriding call to pop twice (see below).
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// one sweep iteration body (0x6925 top): last takes the djnz fall-through to 0x6930.
function iter(last) {
  return [0x6926, 0x6931, 0x692a, 0x692c, 0x692e, last ? 0x6930 : 0x6925];
}

test("loc_6905 Path A: (0x8929)!=0 -> dec and ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x03);

  loc_6905(m);

  assert.equal(m.tstates, 49, "Path A: 10 + 7 + 4 + 7 + 11 + 10");
  assert.deepEqual(m.pcSeq, [0x6908, 0x6909, 0x690a, 0x690c, 0x690d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8929), 0x02, "timer decremented");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6905 Path B: (0x892d)==(0x8903) -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x05);
  m.mem.write8(0x8903, 0x05); // equal -> ret z

  loc_6905(m);

  assert.equal(m.tstates, 72, "Path B: 10+7+4+12+7+7+7+7+11");
  assert.deepEqual(m.pcSeq, [0x6908, 0x6909, 0x690a, 0x690e, 0x6910, 0x6911, 0x6913, 0x6914, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6905 Path B': (0x892d)>=8 -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x09);
  m.mem.write8(0x8903, 0x01); // not equal, but 0x09 >= 8

  loc_6905(m);

  assert.equal(m.tstates, 84, "Path B': 10+7+4+12+7+7+7+7+5+7+11");
  assert.deepEqual(m.pcSeq, [0x6908, 0x6909, 0x690a, 0x690e, 0x6910, 0x6911, 0x6913, 0x6914, 0x6915, 0x6917, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6905 Path C: full 8-record sweep, calling loc_6931 each pass", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8903, 0x01); // not equal, 0x02 < 8 -> run the sweep

  loc_6905(m);

  assert.equal(m.tstates, 672, "Path C: 123 head + 539 loop + 10 ret");
  assert.deepEqual(m.pcSeq, [
    0x6908, 0x6909, 0x690a, 0x690e, 0x6910, 0x6911, 0x6913, 0x6914, 0x6915, 0x6917, 0x6918, 0x691c, 0x6920, 0x6923,
    0x6925, // ld b -> loop top (arrive iteration 1)
    ...iter(false), ...iter(false), ...iter(false), ...iter(false),
    ...iter(false), ...iter(false), ...iter(false), ...iter(true),
    CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x6931, 0x6931, 0x6931, 0x6931, 0x6931, 0x6931, 0x6931, 0x6931]);
  assert.equal(m.regs.ix, 0x8ae0 + 8 * 0x18, "ix advanced one stride past the last record");
  assert.equal(m.regs.iy, 0x8ba0 + 8 * 0x18, "iy advanced one stride past the last record");
  assert.equal(m.regs.sp, 0x8780, "every call unwound the stack to baseline");
});

test("loc_6905 MUTATION: add ix,de mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x692c ? 11 : cycles);
  seatCaller(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8903, 0x01);

  loc_6905(m);

  assert.equal(m.tstates, 672 - 4 * 8, "mutation loses 4T across 8 passes");
  assert.throws(() => assert.equal(m.tstates, 672, "Path C: 123 head + 539 loop + 10 ret"), /Path C/);
});

test("loc_6905 Path C-spawn: loc_6931 spawning on pass 1 aborts the sweep after ONE call (one-spawn)", () => {
  const m = makeMachine();
  // model loc_6931 SPAWNING: its `pop af; ret` drops 6905's pushed continuation (0x6929) and returns to
  // the caller-caller, so pc ends at CALLER_RET -> loc_6905's guard fires and the record sweep aborts.
  m.call = function (addr) {
    this.calls.push(addr);
    this.pop16(); // pop af -- drop the pushed 0x6929 continuation
    this.pc = this.pop16(); // ret -- to the caller-caller (CALLER_RET)
    return undefined;
  };
  seatCaller(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8903, 0x01); // run the sweep

  loc_6905(m);

  assert.deepEqual(m.calls, [0x6931], "spawn on pass 1 -> exactly ONE call; the skip aborted the sweep");
  assert.equal(m.pc, CALLER_RET, "pop-af/ret unwound to the caller-caller (guard propagated the skip)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});
