// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_062a (ROM 0x062a-0x0643): the packed-nibble -> BCD converter.
// Result A = BCD of (hi*16 + lo), where A = (hi<<4 | lo) on entry. Self-contained flat-RAM mock
// (real Regs for exact daa/rrca flags, step/call/ret/push16/pop16). loc_062a makes no calls, so
// the mock seats a caller return the final `ret` pops to prove the exit PC.
// Path A (A=0x23 -> 2*16+3=35 -> 0x35) drives the high-nibble djnz loop with a full pcSeq stepcheck;
// Path B (A=0x07) drives the jr-z (no-high-nibble) branch. TEETH: mis-charge `add a,c` (0x0641,
// 4 T) as 7 T; the 129-T Path A golden must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_062a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_062a } from "../loc_062a.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x062a, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_A = [
  0x062b, 0x062d, 0x062f, 0x0630, 0x0631, 0x0632, 0x0634,
  0x0636, 0x0637, 0x0638, 0x0639, 0x063a, 0x063b, 0x063c,
  0x063e, 0x063f, 0x063c, // djnz iter 1 (taken)
  0x063e, 0x063f, 0x0641, // djnz iter 2 (not taken)
  0x0642, 0x0643, CALLER_RET,
];

function assertPathAGolden(m) {
  assert.equal(m.tstates, 129, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "Path A ends via `ret` (popped caller address)");
  assert.deepEqual(m.calls, [], "Path A makes no calls");
  assert.equal(m.regs.a, 0x35, "A = BCD(2*16+3) = 0x35");
  assert.equal(m.regs.c, 0x03, "C = BCD low nibble");
  assert.equal(m.regs.b, 0x00, "B = high-nibble loop count djnz'd to 0");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
}

test("loc_062a Path A: A=0x23 -> high-nibble djnz loop -> 0x35", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x23;
  loc_062a(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, PC_A, "Path A step boundaries match the ROM bytes");
});

test("loc_062a Path B: A=0x07 -> jr-z (no high nibble) -> 0x07", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x07;
  loc_062a(m);

  assert.equal(m.tstates, 67, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "Path B ends via `ret`");
  assert.equal(m.regs.a, 0x07, "A = BCD(0*16+7) = 0x07");
  assert.equal(m.regs.c, 0x07, "C = BCD low nibble");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(
    m.pcSeq,
    [0x062b, 0x062d, 0x062f, 0x0630, 0x0631, 0x0632, 0x0634, 0x0641, 0x0642, 0x0643, CALLER_RET],
    "Path B boundaries (jr z taken, no djnz loop)",
  );
});

test("loc_062a Path C: A=0x0c -> low-nibble daa correction (0xc -> BCD 0x12)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x0c; // hi=0, lo=0xc: daa BCD-corrects the low nibble to 0x12
  loc_062a(m);
  assert.equal(m.regs.a, 0x12, "A = BCD(0*16+12) = 0x12");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
});

test("loc_062a MUTATION: `add a,c` mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x23;
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0642 ? 7 : cycles);

  loc_062a(m);

  assert.equal(m.tstates, 132, "mutation gains 3 T (4 -> 7)");
  assert.throws(() => assertPathAGolden(m), /Path A T-state total/,
    "the 129-T golden must fail on the mutant");
});
