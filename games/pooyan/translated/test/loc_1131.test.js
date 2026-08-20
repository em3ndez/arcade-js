// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1131 (ROM 0x1131, Pooyan) -- binary->BCD count of B.
 * A=0, C=0, then B iterations of `add a,1; daa`; each 0x99->0x00 wrap (daa sets carry) bumps C.
 * The 0x1133 loop head is inlined (djnz target + fall-through from 0x1131), not a separate entry.
 *
 * Pure leaf (no calls): the mock's `call` still pops (unused here). Paths covered:
 *   B=1  -- jr nc taken once, djnz falls out immediately (full pcSeq, T=49).
 *   B=2  -- jr nc taken twice, one djnz taken then out (full pcSeq, T=85).
 *   B=100 -- 99 no-wrap iters + the 100th wraps (jr nc NOT taken -> inc c), C=1, A=0 (T=3612).
 * TEETH: mis-charge `add a,1` (7 T) as 4 T -> the 49-T golden catches it (a leaf, so the
 * positive control is a T-state mutation, not a push16 deletion).
 *
 * Run: node --test games/pooyan/translated/test/loc_1131.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1131 } from "../loc_1131.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1131, pcSeq: [],
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
    // A callee's `ret` pops the return address the call site pushed -- model that pop (unused: leaf).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1131 B=1: single BCD step, no wrap -> A=1, C=0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;

  loc_1131(m);

  assert.equal(m.tstates, 49, "B=1 T-state total");
  assert.deepEqual(m.pcSeq, [0x1132, 0x1133, 0x1135, 0x1136, 0x1139, 0x113b, CALLER_RET]);
  assert.equal(m.regs.a, 0x01, "A = 1 (BCD)");
  assert.equal(m.regs.c, 0x00, "no hundreds wrap");
  assert.equal(m.regs.b, 0x00, "B counted down");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
  assert.deepEqual(m.calls, []);
});

test("loc_1131 B=2: two BCD steps, one djnz taken -> A=2, C=0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;

  loc_1131(m);

  assert.equal(m.tstates, 85, "B=2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1132, 0x1133,
    0x1135, 0x1136, 0x1139, 0x1133, // iter1: jr nc taken, djnz taken
    0x1135, 0x1136, 0x1139, 0x113b, // iter2: jr nc taken, djnz falls out
    CALLER_RET,
  ]);
  assert.equal(m.regs.a, 0x02, "A = 2 (BCD)");
  assert.equal(m.regs.c, 0x00, "no wrap");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_1131 B=100: the 100th step wraps 99->00 -> A=0, C=1 (inc c path)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 100;

  // Independent model of the ROM's step boundaries: only the 100th iteration wraps (jr nc NOT taken).
  const expected = [0x1132, 0x1133];
  for (let i = 1; i <= 100; i++) {
    expected.push(0x1135, 0x1136);
    if (i === 100) expected.push(0x1138, 0x1139); // jr nc not taken -> inc c
    else expected.push(0x1139);                    // jr nc taken
    expected.push(i < 100 ? 0x1133 : 0x113b);
  }
  expected.push(CALLER_RET);

  loc_1131(m);

  assert.equal(m.regs.a, 0x00, "A wraps to 0 (100 mod 100, BCD)");
  assert.equal(m.regs.c, 0x01, "one hundreds wrap");
  assert.equal(m.regs.b, 0x00);
  assert.deepEqual(m.pcSeq, expected, "wrap only on the 100th iteration");
  assert.equal(m.tstates, 3612, "B=100 T-state total (99*36 + 30 + prologue 8 + ret 10)");
  // exactly one traversal of the inc-c branch
  assert.equal(m.pcSeq.filter((a) => a === 0x1138).length, 1, "inc c reached exactly once");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_1131 MUTATION: `add a,1` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1135 ? 4 : cycles);
  seatCaller(m);
  m.regs.b = 0x01;

  loc_1131(m);

  assert.equal(m.tstates, 46, "mutation loses 3 T (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 49, "B=1 T-state total"),
    /49/,
    "the 49-T golden must fail on the mutant",
  );
});
