// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_01f9 (ROM 0x01f9-0x0219, The Pit).
//
//   01f9  ld sp,0x83ff        ; re-establish the stack (this is a state ENTRY)
//   01fc  call 0x4b14         ; enable NMI
//   01ff  ld a,0x01
//   0201  ld (0x8002),a       ; 0x8002 <- 1  (both paths)
//   0204  call 0x4b55         ; decode DSW
//   0207  ld a,(0x8000)
//   020a  or a                ; Z <- (0x8000 == 0)
//   020b  jp nz,0x021c        ; nonzero -> tail-jump to 0x021c
//   020e  call 0x4c47         ; disable sound        \
//   0211  ld a,0x00            ;                       > zero arm
//   0213  ld (0x8001),a       ; 0x8001 <- 0          /
//   0216  call 0x3b81         ; paint fixed screen  /
//   0219  jp 0x03be           ; tail-jump to 0x03be
//
// Runs on a minimal machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs. Callees are stubbed as
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_01f9's OWN instruction cost. The final
// tail-jumps (0x03be / 0x021c) push nothing, so the stub's pop there just reads
// the (reset) stack top — irrelevant, since the contract asserts the recorded
// `call` sequence and cycle total, not the post-tail-jump SP/PC.
//
// The routine reads no ROM (all operands are immediates or work RAM), so a
// zero-filled ROM image is sufficient. A deliberate MUTATION (branch polarity
// flipped) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_01f9 } from "../loc_01f9.js";

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
}

// -- minimal machine: real mem/io/regs + the step/call/push seam --------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x01f9;
    this.calls = [];
    this.regs.sp = 0x8780; // some mapped stack; the routine's first op resets it
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
  // Stubbed callee: record it, behave as a bare `ret` (pop the pushed address),
  // no cycle charge -- the callee's own cost is not loc_01f9's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

// gate8000 = the value at 0x8000 that selects the fork.
function run(fn, gate8000) {
  const m = new TestMachine(buildRom());
  m.mem.write8(0x8000, gate8000 & 0xff);
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    w8002: m.mem.read8(0x8002),
    w8001: m.mem.read8(0x8001),
    a: m.regs.a,
    fZ: m.regs.fZ,
  };
}

// -- ZERO arm (0x8000 == 0): full fall-through spec ---------------------------
// 155 T = 10+17+7+13+17+13+4 (jp-not-taken 10) +17+7+13+17 (jp 10).
function checkZeroArm(res) {
  assert.equal(res.cycles, 155, "T-state total (zero arm)");
  assert.deepEqual(
    res.calls,
    [0x4b14, 0x4b55, 0x4c47, 0x3b81, 0x03be],
    "zero-arm call/tail-jump sequence",
  );
  assert.equal(res.w8002, 1, "0x8002 armed to 1");
  assert.equal(res.w8001, 0, "0x8001 cleared to 0");
  assert.equal(res.a, 0, "A = 0 on exit (ld a,0x00)");
  assert.equal(res.fZ, true, "Z set: 0x8000 was 0");
}

test("loc_01f9: 0x8000 == 0 takes the zero arm, total 155 T", () => {
  checkZeroArm(run(loc_01f9, 0x00));
});

// -- NONZERO arm (0x8000 != 0): tail-jump straight to 0x021c ------------------
// 91 T = 10+17+7+13+17+13+4 (jp-taken 10). Never touches 0x8001, sound, 0x3b81.
test("loc_01f9: 0x8000 != 0 tail-jumps to 0x021c, total 91 T", () => {
  const res = run(loc_01f9, 0x05);
  assert.equal(res.cycles, 91, "T-state total (nonzero arm)");
  assert.deepEqual(res.calls, [0x4b14, 0x4b55, 0x021c], "nonzero-arm call sequence");
  assert.equal(res.w8002, 1, "0x8002 armed to 1 before the fork");
  assert.equal(res.w8001, 0, "0x8001 untouched (reads back RAM default 0)");
  assert.equal(res.a, 0x05, "A holds the 0x8000 gate value on exit");
  assert.equal(res.fZ, false, "Z clear: 0x8000 was nonzero");
});

// -- MUTATION: branch polarity flipped (fZ instead of fNZ). With 0x8000 == 0 the
// mutant WRONGLY tail-jumps to 0x021c (91 T, calls [4b14,4b55,021c]) instead of
// running the zero arm. The zero-arm spec MUST reject it.
function loc_01f9_mutant(m) {
  const { regs, mem } = m;
  regs.sp = 0x83ff;
  m.step(0x01fc, 10);
  m.push16(0x01ff);
  m.step(0x4b14, 17);
  m.call(0x4b14);
  regs.a = 0x01;
  m.step(0x0201, 7);
  mem.write8(0x8002, regs.a);
  m.step(0x0204, 13);
  m.push16(0x0207);
  m.step(0x4b55, 17);
  m.call(0x4b55);
  regs.a = mem.read8(0x8000);
  m.step(0x020a, 13);
  regs.or(regs.a);
  m.step(0x020b, 4);
  if (regs.fZ) { // BUG: should be fNZ
    m.step(0x021c, 10);
    return m.call(0x021c);
  }
  m.step(0x020e, 10);
  m.push16(0x0211);
  m.step(0x4c47, 17);
  m.call(0x4c47);
  regs.a = 0x00;
  m.step(0x0213, 7);
  mem.write8(0x8001, regs.a);
  m.step(0x0216, 13);
  m.push16(0x0219);
  m.step(0x3b81, 17);
  m.call(0x3b81);
  m.step(0x03be, 10);
  return m.call(0x03be);
}

test("mutation (jp polarity flipped) is caught by the zero-arm spec", () => {
  const bad = run(loc_01f9_mutant, 0x00);
  // Sanity: the mutant really does diverge on the zero-gate input.
  assert.deepEqual(bad.calls, [0x4b14, 0x4b55, 0x021c], "mutant jumped the wrong way");
  assert.equal(bad.cycles, 91, "mutant mischarged the fork");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkZeroArm(bad));
});
