// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4b46 (ROM 0x4b46-0x4b54), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. loc_4b46 is a
// straight line: `ld (0x8057),a`, three CALLs (0x4c11, 0x4c27, 0x4c37) and a
// TAIL `jp 0x4c1c`. The three callees and the tail-jump target are stubbed as
// "pop-and-return" routines that balance the stack but charge no cycles, so the
// asserted T-state total (74) is loc_4b46's OWN instruction cost and the effects
// are isolated from the callees'.
//
// The routine's defining features: (1) it stores the entry-selected A into
// scratch cell 0x8057; (2) it issues EXACTLY those four transfers in order; and
// (3) the final transfer is a TAIL-jump — 0x4c1c's own ret must land on OUR
// caller with the stack balanced, NOT a `m.call; m.ret()` double-pop.
//
// The MUTATION mis-models the tail-jump as `m.call(0x4c1c); m.ret()` (the wrong
// idiom the header warns against). That pops the return address a SECOND time,
// so the mutant lands on garbage instead of the caller, unbalances the stack by
// 2, and charges a phantom +10 T — caught by pc, sp AND the cycle total at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4b46 } from "../loc_4b46.js";

// -- expected T-states, this routine's own instruction cost (stubs add 0) ------
//   ld (nn),a = 13 ; call = 17 ; jp = 10
const EXP_CYCLES = 13 + 17 + 17 + 17 + 10; // == 74

const SENTINEL = 0xbeef; // caller return address the tail-jump's callee `ret` lands on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// Distinctive entry state: A is one of the three real door values (0xc0), and F
// enters with CARRY SET so the test can prove loc_4b46 itself writes no flags.
const A_IN = 0xc0;
const F_IN = F_C; // 0x01

// -- minimal machine: real mem/io/regs + the step/call seam ------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4b46;
    this.calls = [];
    this.regs.sp = SP0;
    this.regs.a = A_IN;
    this.regs.f = F_IN;
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

// Run `fn`. Pushes the caller return address first, exactly as a real CALL into
// loc_4b46 would leave it, so the tail-jump's ret has a target and the stack
// balances. Leaves 0x8057 pre-seeded with a value A must overwrite.
function run(fn, aIn = A_IN) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  m.regs.a = aIn;
  m.mem.write8(0x8057, 0x5a); // sentinel that `ld (0x8057),a` must clobber
  m.push16(SENTINEL);
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    f: m.regs.f,
    m8057: m.mem.read8(0x8057),
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res, aIn = A_IN) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total = 74 (13+17+17+17+10)");
  assert.deepEqual(
    res.calls,
    [0x4c11, 0x4c27, 0x4c37, 0x4c1c],
    "exactly the three callees then the tail-jump target, in order",
  );
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced (every push popped, no double-pop)");
  assert.equal(res.m8057, aIn, "0x8057 = the entry-selected A (clobbers the seed)");
  assert.equal(res.a, aIn, "A itself is untouched by the body");
  assert.equal(res.f, F_IN, "loc_4b46 writes no flags -> F = entry F (carry preserved)");
}

test("loc_4b46: stores A->0x8057, calls 0x4c11/0x4c27/0x4c37, tail-jumps 0x4c1c; 74 T", () => {
  checkSpec(run(loc_4b46));
});

test("loc_4b46: A=0x90 door value also lands in 0x8057 (A is a pure input)", () => {
  checkSpec(run(loc_4b46, 0x90), 0x90);
});

// -- MUTATION: mis-model the tail-jump as `m.call; m.ret()` (double-pop). -------
// The header calls the single-pop tail-jump load-bearing. This mutant issues the
// tail as a plain call FOLLOWED by a ret, popping the return address twice: it
// lands on stack garbage (not SENTINEL), leaves SP 2 above SP0, and charges an
// extra 10 T. checkSpec must reject it.
function loc_4b46_mutant(m) {
  const { regs, mem } = m;
  mem.write8(0x8057, regs.a);
  m.step(0x4b49, 13);
  m.push16(0x4b4c);
  m.step(0x4c11, 17);
  m.call(0x4c11);
  m.push16(0x4b4f);
  m.step(0x4c27, 17);
  m.call(0x4c27);
  m.push16(0x4b52);
  m.step(0x4c37, 17);
  m.call(0x4c37);
  m.step(0x4c1c, 10);
  m.call(0x4c1c);
  m.ret(); // BUG: tail-jump must NOT ret again -- 0x4c1c already returned to our caller
}

test("mutation (tail-jump modelled as call+ret double-pop) is caught", () => {
  // Sanity: the real routine passes its own spec.
  checkSpec(run(loc_4b46));

  const bad = run(loc_4b46_mutant);
  // The mutant popped the return address a SECOND time.
  assert.notEqual(bad.pc, SENTINEL, "mutant landed on garbage, not the caller");
  assert.equal(bad.sp, (SP0 + 2) & 0xffff, "mutant left SP 2 above the balanced SP0");
  assert.equal(bad.cycles, EXP_CYCLES + 10, "mutant charged a phantom second ret (+10 T)");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad), "the spec must reject the double-pop mutant");
});
