// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_03ac (ROM 0x03ac-0x03bb, The Pit) -- the
// reset/entry EPILOGUE that clears the player-number byte, arms 0x8002 = 1, runs
// two setup calls, then tail-jumps into the 0x01f9 reset/entry handler.
//
//   03ac  ld a,0x00           ; A = 0
//   03ae  ld (0x8001),a       ; clear player number
//   03b1  inc a               ; A = 1
//   03b2  ld (0x8002),a       ; arm 0x8002 = 1
//   03b5  call 0x4b55         ; decode DSW
//   03b8  call 0x3a6f         ; setup
//   03bb  jp 0x01f9           ; tail-jump to reset/entry handler
//
// Runs on a minimal machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs. Callees are stubbed as
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_03ac's OWN instruction cost.
//
// The routine is straight-line and ends in an unconditional tail-jump: the mock's
// call() records the tail target 0x01f9 and pops the entry frame (no push precedes
// the tail-jump), so the recorded call sequence proving the tail-jump fired is
// [0x4b55, 0x3a6f, 0x01f9] with NO ret ever executed by loc_03ac itself.
//
// T-states are hand-derived off the opcode tables (ld a,n = 7; ld (nn),a = 13;
// inc r = 4; call = 17; jp = 10), independently of the translation, so a cycle
// error shows up as a mismatch rather than agreeing with itself.
//
// A deliberate MUTATION (the 0x8001 clear value 0x00 -> 0x01) is asserted to be
// caught by the golden spec -- proving the memory-effect assertions have teeth
// beyond the cycle count (the mutant charges the identical 81 T).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_03ac } from "../loc_03ac.js";

// -- T-state accounting (independent of the translation) ----------------------
//   ld a,n @7  +  ld (nn),a @13  +  inc a @4  +  ld (nn),a @13
//   +  2x call @17  +  jp @10
const TOTAL = 7 + 13 + 4 + 13 + 2 * 17 + 10; // 81

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
    this.pc = 0x03ac;
    this.calls = [];
    this.retCount = 0; // MUST stay 0 -- loc_03ac tail-jumps, it never rets
    this.regs.sp = 0x8780; // some mapped stack (loc_03ac has no `ld sp` of its own)
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
  // no cycle charge -- the callee's own cost is not loc_03ac's.
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
    w8002: m.mem.read8(0x8002),
  };
}

// -- Golden spec: the memory footprint, control flow, and cycle total ---------
function checkGolden(res) {
  assert.equal(res.retCount, 0, "loc_03ac tail-jumps -- it never executes a ret itself");
  assert.deepEqual(
    res.calls,
    [0x4b55, 0x3a6f, 0x01f9],
    "call/tail-jump sequence: DSW decode, setup, then the 0x01f9 tail-jump",
  );
  assert.equal(res.w8001, 0x00, "0x8001 = 0 -- player number cleared");
  assert.equal(res.w8002, 0x01, "0x8002 armed to 1 (inc'd A)");
  assert.equal(res.a, 0x01, "A = 1 on exit (ld a,0 then inc a)");
  assert.equal(res.cycles, TOTAL, "T-state total = 81");
}

test("loc_03ac: clears player number, arms 0x8002, tail-jumps to 0x01f9; 81 T", () => {
  const res = run(loc_03ac);
  assert.equal(res.cycles, 81, "explicit golden total for the straight-line body");
  checkGolden(res);
});

// -- MUTATION: the 0x8001 clear value 0x00 -> 0x01. The routine's point is to
// CLEAR the player-number byte to 0 before re-entering; a value of 1 leaves a stale
// player selected. The T-state total is identical (ld a,0x01 costs the same 7 T as
// ld a,0x00), and A on exit would be 2 (inc of 1) -- so ONLY the memory-effect
// assertion on 0x8001 catches it. Straight-line trace = exactly the mutant's path.
function loc_03ac_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = 0x01; m.step(0x03ae, 7); // BUG: should be ld a,0x00 (clear player number)
  mem.write8(0x8001, regs.a); m.step(0x03b1, 13);
  regs.a = regs.inc8(regs.a); m.step(0x03b2, 4);
  mem.write8(0x8002, regs.a); m.step(0x03b5, 13);
  m.push16(0x03b8); m.step(0x4b55, 17); m.call(0x4b55);
  m.push16(0x03bb); m.step(0x3a6f, 17); m.call(0x3a6f);
  m.step(0x01f9, 10);
  return m.call(0x01f9);
}

test("mutation (0x8001 clear 0x00 -> 0x01) is caught by the golden spec", () => {
  // Sanity: the real routine passes its own golden spec.
  checkGolden(run(loc_03ac));

  const bad = run(loc_03ac_MUTANT);
  // The mutant really diverges: it left a stale player number in 0x8001...
  assert.equal(bad.w8001, 0x01, "mutant stored 1 instead of clearing to 0");
  // ...but charged the IDENTICAL cycle total, so the cycle assertion alone misses it.
  assert.equal(bad.cycles, 81, "mutant's T-state total is unchanged -- memory assertion must catch it");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkGolden(bad));
});
