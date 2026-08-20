// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f06 (ROM 0x5f06, Pooyan) -- the tail of the 0x5ebd actor sweep:
 * advance IX by one record (+4) and HL by one row (+0x18), then `djnz 0x5ebd`. A taken djnz delegates
 * back to the loop body via m.call(0x5ebd) (loop-back across a routine boundary); B==0 returns.
 *
 * The mock's `call` POPS the return address the site pushed -- loc_5f06 makes no CALL (only the tail
 * djnz), so the pop models the CALLEE's ret consuming the seated CALLER_RET (loop-back reuses the frame).
 *
 * Path LOOP (B=2): djnz taken -> tail m.call(0x5ebd), SP unwinds to the pre-seat baseline. Path EXIT
 * (B=1): djnz falls out -> ret to the seated caller. TEETH: mis-charge `add ix,de` (15 T) as 11 T ->
 * the golden total catches it. Pure-leaf positive control (a T-state mutation) is exercised below.
 *
 * Run: node --test games/pooyan/translated/test/loc_5f06.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f06 } from "../loc_5f06.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f06, pcSeq: [],
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
    // The loop-back reuses the caller's frame, so the eventual callee `ret` pops the seated CALLER_RET.
    // The mock models that pop here (a stray push/pop imbalance then desyncs SP and fails the tooth).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5f06 Path LOOP: B=2 -> djnz taken -> tail to 0x5ebd", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8888;
  m.regs.hl = 0x8c30;
  m.regs.b = 0x02;

  loc_5f06(m);

  assert.equal(m.tstates, 10 + 15 + 7 + 11 + 13, "Path LOOP T-state total (=56)");
  assert.deepEqual(m.pcSeq, [0x5f09, 0x5f0b, 0x5f0d, 0x5f0e, 0x5ebd]);
  assert.equal(m.pc, 0x5ebd, "djnz taken lands on the loop body");
  assert.deepEqual(m.calls, [0x5ebd]);
  assert.equal(m.regs.ix, 0x888c, "IX += 4 (next record)");
  assert.equal(m.regs.hl, 0x8c48, "HL += 0x18 (next row)");
  assert.equal(m.regs.b, 0x01, "B decremented");
  assert.equal(m.regs.sp, 0x8780, "tail loop-back unwinds SP to the pre-seat baseline");
});

test("loc_5f06 Path EXIT: B=1 -> djnz falls out -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8888;
  m.regs.hl = 0x8c30;
  m.regs.b = 0x01;

  loc_5f06(m);

  assert.equal(m.tstates, 10 + 15 + 7 + 11 + 8 + 10, "Path EXIT T-state total (=61)");
  assert.deepEqual(m.pcSeq, [0x5f09, 0x5f0b, 0x5f0d, 0x5f0e, 0x5f10, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.b, 0x00, "B reached 0");
  assert.equal(m.regs.sp, 0x8780, "ret consumed the seated CALLER_RET");
});

test("loc_5f06 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5f0b ? 11 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8888;
  m.regs.hl = 0x8c30;
  m.regs.b = 0x02;

  loc_5f06(m);

  assert.equal(m.tstates, 52, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 56, "Path LOOP T-state total"),
    /56/,
    "the 56-T golden must fail on the mutant",
  );
});
