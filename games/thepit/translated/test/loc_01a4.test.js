// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_01a4 (ROM 0x01a4-0x01f8, The Pit) — the
// cold-boot / power-on init entry.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a fresh (zero)
// ROM. Every `call` callee (0x4b10, 0x4bea, ..., 0x4bff) is stubbed as a trivial
// "pop-and-return" that balances the stack but adds no cycles, so the asserted
// T-state total is loc_01a4's OWN instruction cost.
//
// The routine resets SP to 0x83ff, so the eventual return chain points at the
// reset-stack top: a SENTINEL is seeded at 0x83ff/0x8400, and the tail-jump into
// 0x03ac (modelled as `return m.call`) lands its callee `ret` there — proving the
// jp is a tail-jump, not a call+ret.
//
// The mutation is a CYCLE-ONLY break (djnz taken charged 12 instead of 13). It
// moves no memory — the busy-delay writes nothing — so ONLY the T-state assertion
// catches it. That is the whole point of charging cycles (docs/03-translation.md):
// a timing error invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_01a4 } from "../loc_01a4.js";

const SENTINEL = 0xbeef; // return address the tail-jump's callee `ret` must land on
const RESET_SP = 0x83ff; // SP after `ld sp,0x83ff`; the reset-stack top

// -- T-state accounting (own instruction cost; stubbed callees add 0) ---------
//   prologue: di..ld bc, including 9 calls@17 counted in the epilogue split below.
// di(4)+im1(8)+ldsp(10)+call(17)+lda(7)+4*ld(nn)(13)+lda(7)+2*ld(13)+lda(7)
// +2*ld(13)+rlca(4)+ld(13)+6*call(17)+lda(7)+ld(13)+call(17)+ldbc(10)
const PROLOGUE =
  4 + 8 + 10 + 17 + 7 + 4 * 13 + 7 + 2 * 13 + 7 + 2 * 13 + 4 + 13 + 6 * 17 + 7 + 13 + 17 + 10; // 330
//   delay: bc=0x0000. inner pass = 256 djnz execs (255 taken@13 + 1 not-taken@8).
const INNER = 255 * 13 + 8; // 3323
//   256 outer passes; dec c@4 each; jr nz 255 taken@12 + 1 not-taken@7.
const LOOP = 256 * INNER + 256 * 4 + (255 * 12 + 7); // 854779
const EPILOGUE = 7 /*ld a,0x3c*/ + 17 /*call 0x4bff*/ + 10; /*jp 0x03ac (tail, 10 T)*/ // 34
const EXP_CYCLES = PROLOGUE + LOOP + EPILOGUE; // 855143

// Every `call`/tail-jump target the routine transfers to, in order.
const EXP_CALLS = [0x4b10, 0x4bea, 0x4bc7, 0x4c4d, 0x4b44, 0x4b3c, 0x4c57, 0x4b55, 0x4bff, 0x03ac];

// Work-RAM bytes the routine seeds (address -> value).
const EXP_MEM = {
  0x8000: 0x00,
  0x801c: 0x00,
  0x812c: 0x00,
  0x8001: 0x00,
  0x8015: 0x06,
  0x8016: 0x06,
  0x8004: 0x55,
  0x8005: 0x55,
  0x8003: 0xaa, // rlca(0x55)
  0x8002: 0x01,
};

// -- minimal machine: real mem/io/regs + the step/call seam ------------------
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io); // fresh zero ROM
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x01a4;
    this.calls = [];
    // Seed the SENTINEL at the reset-stack top so the tail-jump's callee ret lands there.
    this.mem.write8(RESET_SP, SENTINEL & 0xff);
    this.mem.write8((RESET_SP + 1) & 0xffff, (SENTINEL >> 8) & 0xff);
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
  const m = new TestMachine();
  fn(m);
  return {
    cycles: m.cycles,
    work: m.mem.workRam.slice(),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    c: m.regs.c,
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  for (const [addr, val] of Object.entries(EXP_MEM)) {
    assert.equal(res.work[Number(addr) - 0x8000], val, `work RAM 0x${Number(addr).toString(16)}`);
  }
  assert.deepEqual(res.calls, EXP_CALLS, "call sequence (8 setup calls + delay + tail-jump)");
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on the reset-stack return slot");
  assert.equal(res.sp, (RESET_SP + 2) & 0xffff, "SP = reset top + 2 after the single tail-jump pop");
  assert.equal(res.a, 0x3c, "A = 0x3c into the 0x4bff delay-arm call");
  assert.equal(res.b, 0x00, "B wrapped back to 0");
  assert.equal(res.c, 0x00, "C counted down to 0");
}

test("loc_01a4: cold-boot init, seeds work RAM, delays, tail-jumps 0x03ac; 855143 T", () => {
  checkSpec(run(loc_01a4));
});

// -- MUTATION: charge the taken djnz 12 T instead of 13. Moves NO memory (the
// busy-delay writes nothing), so the work-RAM diff stays green -- only the
// T-state total (256*255 = 65280 T short) exposes it. Proves the cycle assertion
// earns its keep.
function loc_01a4_mutant(m) {
  const { regs, mem } = m;
  m.step(0x01a5, 4);
  m.step(0x01a7, 8);
  regs.sp = 0x83ff;
  m.step(0x01aa, 10);
  m.push16(0x01ad);
  m.step(0x4b10, 17);
  m.call(0x4b10);
  regs.a = 0x00;
  m.step(0x01af, 7);
  mem.write8(0x8000, regs.a);
  m.step(0x01b2, 13);
  mem.write8(0x801c, regs.a);
  m.step(0x01b5, 13);
  mem.write8(0x812c, regs.a);
  m.step(0x01b8, 13);
  mem.write8(0x8001, regs.a);
  m.step(0x01bb, 13);
  regs.a = 0x06;
  m.step(0x01bd, 7);
  mem.write8(0x8015, regs.a);
  m.step(0x01c0, 13);
  mem.write8(0x8016, regs.a);
  m.step(0x01c3, 13);
  regs.a = 0x55;
  m.step(0x01c5, 7);
  mem.write8(0x8004, regs.a);
  m.step(0x01c8, 13);
  mem.write8(0x8005, regs.a);
  m.step(0x01cb, 13);
  regs.rlca();
  m.step(0x01cc, 4);
  mem.write8(0x8003, regs.a);
  m.step(0x01cf, 13);
  m.push16(0x01d2);
  m.step(0x4bea, 17);
  m.call(0x4bea);
  m.push16(0x01d5);
  m.step(0x4bc7, 17);
  m.call(0x4bc7);
  m.push16(0x01d8);
  m.step(0x4c4d, 17);
  m.call(0x4c4d);
  m.push16(0x01db);
  m.step(0x4b44, 17);
  m.call(0x4b44);
  m.push16(0x01de);
  m.step(0x4b3c, 17);
  m.call(0x4b3c);
  m.push16(0x01e1);
  m.step(0x4c57, 17);
  m.call(0x4c57);
  regs.a = 0x01;
  m.step(0x01e3, 7);
  mem.write8(0x8002, regs.a);
  m.step(0x01e6, 13);
  m.push16(0x01e9);
  m.step(0x4b55, 17);
  m.call(0x4b55);
  regs.bc = 0x0000;
  m.step(0x01ec, 10);
  for (;;) {
    for (;;) {
      if (regs.djnz() !== 0) {
        m.step(0x01ec, 12); // BUG: djnz taken is 13 T, not 12
      } else {
        m.step(0x01ee, 8);
        break;
      }
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x01ef, 4);
    if (regs.fNZ) {
      m.step(0x01ec, 12);
    } else {
      m.step(0x01f1, 7);
      break;
    }
  }
  regs.a = 0x3c;
  m.step(0x01f3, 7);
  m.push16(0x01f6);
  m.step(0x4bff, 17);
  m.call(0x4bff);
  m.step(0x03ac, 10);
  return m.call(0x03ac);
}

test("mutation (djnz taken mischarged 12 T) is caught by the cycle assertion", () => {
  const bad = run(loc_01a4_mutant);
  // Memory is byte-identical -- a state-only diff would MISS this.
  for (const [addr, val] of Object.entries(EXP_MEM)) {
    assert.equal(bad.work[Number(addr) - 0x8000], val, "work RAM identical to the correct run");
  }
  // 256 passes * 255 taken djnz, each 1 T short = 65280 T under the true total.
  assert.equal(bad.cycles, EXP_CYCLES - 65280, "mutant is exactly 65280 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
