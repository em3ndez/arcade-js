// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_47e1 (ROM 0x47E1-0x4815, The Pit).
//
// sub_47e1 seeds the shared tile-plotter params at 0x8055-0x8059, calls the four
// plot helpers (0x3dae, 0x3dc9, 0x3dea, 0x3ddb) and TAIL-jumps (jp) into 0x3e01.
// Runs on the lightweight machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs, with the callees stubbed
// as "pop-and-return" (balance the stack, charge no cycles) so the asserted
// T-state total is sub_47e1's OWN instruction cost. Assertions cover: the exact
// cycle total, the call/tail-jump order, the final 0x8055-0x8059/0x8057 writes,
// A/IX at the tail, and that the tail-jump lands PC back on the caller with the
// stack balanced. A deliberate MUTATION (a mistimed step) is asserted caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_47e1 } from "../sub_47e1.js";

const SENTINEL = 0xbeef; // caller return address the tail-jump must land on
const SP0 = 0x8780; // stack top, inside work RAM (0x8000-0x87ff)

// -- minimal machine: real mem/io/regs + the step/call/ret seam --------------
// call() records the target then behaves as a bare `ret` (pop the pushed return
// address, land PC on it) with NO cycle charge -- each callee's own cost is not
// sub_47e1's. This mirrors games/thepit/translated/test/sub_4689.test.js.
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x47e1;
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
  m.push16(SENTINEL); // caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    pc: m.pc,
    sp: m.regs.sp,
    calls: m.calls,
    a: m.regs.a,
    ix: m.regs.ix,
    p8055: m.mem.read8(0x8055),
    p8057: m.mem.read8(0x8057),
    p8058: m.mem.read8(0x8058),
    p8059: m.mem.read8(0x8059),
  };
}

// Own T-state cost, grouped by opcode:
//   ld a,n     7 x6  = 42   (47e1, 47e6, 47f1, 47f6, 4802, 480e)
//   ld (nn),a  13 x6 = 78   (8058, 8059, 8057, and 8055 x3)
//   call nn    17 x4 = 68   (3dae, 3dc9, 3dea, 3ddb)
//   ld ix,nn   14 x2 = 28   (8002, 49b1)
//   jp nn      10 x1 = 10   (3e01)
// -> 42 + 78 + 68 + 28 + 10 = 226.
const OWN_CYCLES = 226;

function check(res) {
  assert.equal(res.cycles, OWN_CYCLES, "own T-state total");
  // Four ordinary calls in ROM order, then the tail-jump into 0x3e01.
  assert.deepEqual(
    res.calls,
    [0x3dae, 0x3dc9, 0x3dea, 0x3ddb, 0x3e01],
    "call + tail-jump order",
  );
  assert.equal(res.pc, SENTINEL, "tail-jump ret lands on caller");
  assert.equal(res.sp, SP0, "stack balanced through calls + tail-jump");
  // Final param writes (0x8055 written three times -> last wins).
  assert.equal(res.p8055, 0x09, "0x8055 = 9 (last run length)");
  assert.equal(res.p8057, 0x07, "0x8057 = fill byte");
  assert.equal(res.p8058, 0x01, "0x8058 = column group");
  assert.equal(res.p8059, 0x0c, "0x8059 = row");
  assert.equal(res.a, 0x09, "A = 0x09 at the tail (last ld a,0x09)");
  assert.equal(res.ix, 0x49b1, "IX = 0x49b1 at the tail (last ld ix)");
}

test("sub_47e1: seeds plot params, calls 4 helpers, tail-jumps to sub_3e01", () => {
  check(run(sub_47e1));
});

// Intermediate 0x8055 values are observable via the stubbed callees: the run
// length is 1 when sub_3dea runs and 7 when sub_3ddb runs. A machine that snoops
// 0x8055 at each call confirms the writes land in order (not just the final 9).
test("sub_47e1: 0x8055 = 1 at sub_3dea, 7 at sub_3ddb, 9 at the tail", () => {
  const m = new TestMachine();
  const seen = {};
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    seen[addr] = m.mem.read8(0x8055);
    return realCall(addr);
  };
  m.push16(SENTINEL);
  sub_47e1(m);
  assert.equal(seen[0x3dea], 0x01, "run length 1 when sub_3dea runs");
  assert.equal(seen[0x3ddb], 0x07, "run length 7 when sub_3ddb runs");
  assert.equal(seen[0x3e01], 0x09, "run length 9 at the tail into sub_3e01");
});

// -- MUTATION: mistime one step (charge the last `ld (0x8055),a` as 4 T, the
// register-form cost, instead of the memory-form 13 T). Value effects are
// unchanged, so ONLY the cycle assertion catches it -- exactly the class of bug
// stepcheck exists for. The real routine's spec MUST reject the mutant.
function sub_47e1_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x47e3, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x47e6, 13);
  regs.a = 0x0c;
  m.step(0x47e8, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x47eb, 13);
  m.push16(0x47ee);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x47f1);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x07;
  m.step(0x47f3, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x47f6, 13);
  regs.a = 0x01;
  m.step(0x47f8, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x47fb, 13);
  regs.ix = 0x8002;
  m.step(0x47ff, 14);
  m.push16(0x4802);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  regs.a = 0x07;
  m.step(0x4804, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x4807, 13);
  regs.ix = 0x49b1;
  m.step(0x480b, 14);
  m.push16(0x480e);
  m.step(0x3ddb, 17);
  m.call(0x3ddb);
  regs.a = 0x09;
  m.step(0x4810, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x4813, 4); // BUG: `ld (0x8055),a` is 13 T, not 4
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (mistimed ld (0x8055),a) is caught by the T-state spec", () => {
  const bad = run(sub_47e1_mutant);
  // Sanity: values still match, only the cycle count diverges.
  assert.equal(bad.p8055, 0x09);
  assert.deepEqual(bad.calls, [0x3dae, 0x3dc9, 0x3dea, 0x3ddb, 0x3e01]);
  assert.equal(bad.cycles, OWN_CYCLES - 9, "mutant undercharges by 9 T");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => check(bad));
});
