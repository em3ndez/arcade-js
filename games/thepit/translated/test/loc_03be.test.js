// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_03be (ROM 0x03be-0x03e7, The Pit) -- the
// play/state ENTRY that arms game-mode 4, seeds the per-round gameplay counters,
// runs two setup calls, then tail-jumps into loc_031a.
//
//   03be  ld a,0x04           ; game-mode byte
//   03c0  ld (0x8001),a       ; enter play mode (loc_0348 runs 0x03e8 while ==4)
//   03c3  ld a,0x01
//   03c5  ld (0x801b),a
//   03c8  ld (0x8002),a       ; arm 0x8002 = 1 (A still 1)
//   03cb  ld a,0x03
//   03cd  ld (0x8029),a
//   03d0  call 0x4c47
//   03d3  call 0x4b55         ; decode DSW
//   03d6  ld a,0x0c
//   03d8  ld (0x804e),a       ; delay base for loc_031a
//   03db  ld a,0x01
//   03dd  ld (0x800b),a       ; 0x03e8 phase countdown
//   03e0  ld a,0x00
//   03e2  ld (0x800c),a       ; 0x03e8 phase index = 0
//   03e5  jp 0x031a           ; tail-jump into round/play (re)init
//
// Runs on a minimal machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs. Callees are stubbed as
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_03be's OWN instruction cost.
//
// The routine is straight-line and ends in an unconditional tail-jump: the mock's
// call() records the tail target 0x031a and pops the entry frame (no push precedes
// the tail-jump), so the recorded call sequence proving the tail-jump fired is
// [0x4c47, 0x4b55, 0x031a] with NO ret ever executed by loc_03be itself.
//
// T-states are hand-derived off the opcode tables (ld a,n = 7; ld (nn),a = 13;
// call = 17; jp = 10), independently of the translation, so a cycle error shows
// up as a mismatch rather than agreeing with itself.
//
// A deliberate MUTATION (the game-mode store value 0x04 -> 0x03) is asserted to be
// caught by the golden spec -- proving the memory-effect assertions have teeth
// beyond the cycle count (the mutant charges the identical 177 T).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_03be } from "../loc_03be.js";

// -- T-state accounting (independent of the translation) ----------------------
//   6x ld a,n @7  +  7x ld (nn),a @13  +  2x call @17  +  1x jp @10
const TOTAL = 6 * 7 + 7 * 13 + 2 * 17 + 10; // 177

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
    this.pc = 0x03be;
    this.calls = [];
    this.retCount = 0; // MUST stay 0 -- loc_03be tail-jumps, it never rets
    this.regs.sp = 0x8780; // some mapped stack (loc_03be has no `ld sp` of its own)
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
  // no cycle charge -- the callee's own cost is not loc_03be's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.retCount += 1;
    this.step(this.pop16(), cycles);
  }
}

function run(fn) {
  const m = new TestMachine(buildRom());
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    retCount: m.retCount,
    a: m.regs.a,
    w8001: m.mem.read8(0x8001),
    w801b: m.mem.read8(0x801b),
    w8002: m.mem.read8(0x8002),
    w8029: m.mem.read8(0x8029),
    w804e: m.mem.read8(0x804e),
    w800b: m.mem.read8(0x800b),
    w800c: m.mem.read8(0x800c),
  };
}

// -- Golden spec: the whole memory footprint, control flow, and cycle total ---
function checkGolden(res) {
  assert.equal(res.retCount, 0, "loc_03be tail-jumps -- it never executes a ret itself");
  assert.deepEqual(
    res.calls,
    [0x4c47, 0x4b55, 0x031a],
    "call/tail-jump sequence: two setup calls then the 0x031a tail-jump",
  );
  assert.equal(res.w8001, 0x04, "0x8001 = 4 -- entered play mode");
  assert.equal(res.w801b, 0x01, "0x801b = 1");
  assert.equal(res.w8002, 0x01, "0x8002 armed to 1");
  assert.equal(res.w8029, 0x03, "0x8029 = 3");
  assert.equal(res.w804e, 0x0c, "0x804e = 0x0c (delay base)");
  assert.equal(res.w800b, 0x01, "0x800b = 1 (phase countdown)");
  assert.equal(res.w800c, 0x00, "0x800c = 0 (phase index reset)");
  assert.equal(res.a, 0x00, "A = 0 on exit (last load was ld a,0x00)");
  assert.equal(res.cycles, TOTAL, "T-state total = 177");
}

test("loc_03be: arms mode 4, seeds counters, tail-jumps to 0x031a; 177 T", () => {
  const res = run(loc_03be);
  assert.equal(res.cycles, 177, "explicit golden total for the straight-line body");
  checkGolden(res);
});

// -- MUTATION: the game-mode store value 0x04 -> 0x03. The routine's whole point
// is to ENTER play mode (0x8001 == 4, which is what loc_0348 tests before running
// 0x03e8); a mode of 3 would silently fail to enter play. The T-state total is
// identical (ld a,0x03 costs the same 7 T as ld a,0x04), so ONLY the memory-effect
// assertion catches it. Straight-line trace = exactly the mutant's executed path.
function loc_03be_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = 0x03; m.step(0x03c0, 7); // BUG: should be ld a,0x04 (enter play mode)
  mem.write8(0x8001, regs.a); m.step(0x03c3, 13);
  regs.a = 0x01; m.step(0x03c5, 7);
  mem.write8(0x801b, regs.a); m.step(0x03c8, 13);
  mem.write8(0x8002, regs.a); m.step(0x03cb, 13);
  regs.a = 0x03; m.step(0x03cd, 7);
  mem.write8(0x8029, regs.a); m.step(0x03d0, 13);
  m.push16(0x03d3); m.step(0x4c47, 17); m.call(0x4c47);
  m.push16(0x03d6); m.step(0x4b55, 17); m.call(0x4b55);
  regs.a = 0x0c; m.step(0x03d8, 7);
  mem.write8(0x804e, regs.a); m.step(0x03db, 13);
  regs.a = 0x01; m.step(0x03dd, 7);
  mem.write8(0x800b, regs.a); m.step(0x03e0, 13);
  regs.a = 0x00; m.step(0x03e2, 7);
  mem.write8(0x800c, regs.a); m.step(0x03e5, 13);
  m.step(0x031a, 10);
  return m.call(0x031a);
}

test("mutation (mode store 0x04 -> 0x03) is caught by the golden spec", () => {
  // Sanity: the real routine passes its own golden spec.
  checkGolden(run(loc_03be));

  const bad = run(loc_03be_MUTANT);
  // The mutant really diverges: it wrote the wrong game mode to 0x8001...
  assert.equal(bad.w8001, 0x03, "mutant stored mode 3 instead of 4");
  // ...but charged the IDENTICAL cycle total, so the cycle assertion alone misses it.
  assert.equal(bad.cycles, 177, "mutant's T-state total is unchanged -- memory assertion must catch it");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkGolden(bad));
});
