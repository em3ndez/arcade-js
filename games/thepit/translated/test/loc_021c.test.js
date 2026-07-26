// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_021c (ROM 0x021c-0x022c), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. The three callees
// (0x4b14, 0x4b44, and the tail-jump target 0x3ba8) are stubbed as trivial
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_021c's OWN instruction cost (74 T).
//
// The load-bearing behaviour under test is `ld sp,0x83ff`: it REINITIALISES the
// stack, DISCARDING the caller's return address. The test proves this two ways --
// (1) the caller's return word left in RAM is never touched, and (2) the two
// intervening `call`s push/pop on the RESET stack, so the tail-jump's pop returns
// the marker seeded at the reset stack top (0x83ff), not the caller's return.
//
// The MUTATION is a CYCLE-ONLY break (the first `call` charged 10 instead of 17).
// It moves no memory and changes no register or control-flow landing, so ONLY the
// T-state assertion catches it -- the docs/03-translation.md point that a timing
// error can be invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_021c } from "../loc_021c.js";

// -- T-state accounting (own instruction cost; stubbed callees add 0) ----------
//   ld a,n(7) + ld(nn),a(13) + ld sp,nn(10) + call(17) + call(17) + jp(10)
const EXP_CYCLES = 7 + 13 + 10 + 17 + 17 + 10; // 74

const SP0 = 0x8700; // caller's stack pointer on entry
const CALLER_RET = 0xbeef; // caller's return address -- `ld sp,0x83ff` must DISCARD it
const CALLER_RET_ADDR = SP0 - 2; // where run() leaves it (0x86fe)
const RESET_SP = 0x83ff; // the SP loc_021c installs
const MARK = 0xcafe; // seeded at the reset stack top; the tail-jump's pop returns it

// -- minimal machine: real mem/io/regs + the step/call/push/pop seam ----------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x021c;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address the
  // CALL/JP left on the stack). No cycle charge -- the callee's cost is not ours.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(fn) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  m.push16(CALLER_RET); // caller's return address, at 0x86fe -- must be discarded
  m.mem.write16(RESET_SP, MARK); // marker at the reset stack top (0x83ff/0x8400)
  fn(m);
  return {
    cycles: m.cycles,
    mode: m.mem.read8(0x8001),
    a: m.regs.a,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    callerRetWord: m.mem.read16(CALLER_RET_ADDR),
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total (own cost, 74 T)");
  assert.equal(res.mode, 0x03, "mode cell 0x8001 seeded with 3");
  assert.equal(res.a, 0x03, "A holds loc_021c's own load (callees stubbed)");
  assert.deepEqual(res.calls, [0x4b14, 0x4b44, 0x3ba8], "call sequence: 2 setup + tail-jump");
  // ld sp,0x83ff took effect: the two balanced calls left SP at 0x83ff, then the
  // tail-jump popped the reset-stack-top marker -> pc = MARK, sp = 0x8401.
  assert.equal(res.pc, MARK, "tail-jump popped from the RESET stack top, not the caller's return");
  assert.equal(res.sp, (RESET_SP + 2) & 0xffff, "SP past the reset stack top after the tail pop");
  // The caller's return address was DISCARDED, not returned to: it still sits
  // untouched in RAM and never became the PC.
  assert.equal(res.callerRetWord, CALLER_RET, "caller's return word untouched in RAM (discarded)");
  assert.notEqual(res.pc, CALLER_RET, "control never returned to the caller");
}

test("loc_021c: seeds mode=3, resets SP, enables NMI, sets up, tail-jumps 0x3ba8; 74 T", () => {
  checkSpec(run(loc_021c));
});

// -- MUTATION: charge the first `call 0x4b14` 10 T instead of 17. It pushes/pops
// the same word, lands control the same place, and touches no register -- memory,
// PC, SP and A are all byte-identical. ONLY the 7-T-short total exposes it, which
// is the whole reason cycles are charged (docs/03-translation.md).
function loc_021c_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x03;
  m.step(0x021e, 7);
  mem.write8(0x8001, regs.a, 10);
  m.step(0x0221, 13);
  regs.sp = 0x83ff;
  m.step(0x0224, 10);
  m.push16(0x0227);
  m.step(0x4b14, 10); // BUG: an unconditional `call` is 17 T, not 10
  m.call(0x4b14);
  m.push16(0x022a);
  m.step(0x4b44, 17);
  m.call(0x4b44);
  m.step(0x3ba8, 10);
  return m.call(0x3ba8);
}

test("mutation (call mischarged 10 T) is caught by the cycle assertion", () => {
  const bad = run(loc_021c_mutant);
  // Everything the state diff sees is identical to the correct run...
  assert.equal(bad.mode, 0x03, "mode cell identical");
  assert.equal(bad.a, 0x03, "A identical");
  assert.deepEqual(bad.calls, [0x4b14, 0x4b44, 0x3ba8], "control flow identical");
  assert.equal(bad.pc, MARK, "PC landing identical");
  assert.equal(bad.sp, (RESET_SP + 2) & 0xffff, "SP identical");
  // ...only the T-state total is off, by exactly the 7 T shorted.
  assert.equal(bad.cycles, EXP_CYCLES - 7, "mutant is exactly 7 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
