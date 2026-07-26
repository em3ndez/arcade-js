// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4cbf (ROM 0x4cbf-0x4cc9 + fall-through into
// loc_4cca), The Pit.
//
// loc_4cbf is now just the prologue: it clears the flag at 0x8048, calls 0x4644
// and 0x4d3a, then FALLS THROUGH into loc_4cca (its OWN routine -- 0x4cca is also
// entered by `jp 0x4cca` from loc_4bc7 / loc_4df8, so it is a routine boundary and
// must not be inlined). The record block-copies / value formatting belong to
// loc_4cca and are NOT asserted here (0x4cca is stubbed).
//
// Runs on a lightweight machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs. The callees (0x4644,
// 0x4d3a, and the tail-delegate 0x4cca) are stubbed as "pop-and-return" routines
// that balance the stack but add no cycles, so the asserted T-state total is
// loc_4cbf's OWN instruction cost (7+13+17+17 = 54). The KEY control-flow claim
// under test is that loc_4cca is reached by FALL-THROUGH and delegated as a
// TAIL-call (no trailing ret), so loc_4cca's ret lands on loc_4cbf's own caller. A
// deliberate mutation (delegate modelled as a real call + trailing ret) is
// asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4cbf } from "../loc_4cbf.js";

const SENTINEL = 0xbeef; // caller's return address; loc_4cca's ret (via delegate) must land here

// -- minimal machine: real mem/io/regs + the step/call/push seam ---------------
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4cbf;
    this.calls = [];
    this.regs.sp = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop whatever the site
  // left on the stack). For the two mid-routine CALLs that is the pushed return;
  // for the tail-DELEGATE (loc_4cca, entered with nothing extra pushed) it is the
  // SENTINEL -- which is the whole point: loc_4cca returns to loc_4cbf's caller.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function seed(m) {
  m.mem.write8(0x8048, 0xff); // pre-dirty the flag so the ld (0x8048),a clear is observable
}

function run(fn) {
  const m = new TestMachine();
  seed(m);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    flag: m.mem.read8(0x8048),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
  };
}

// Full spec for the SPLIT loc_4cbf: its OWN effects only (0x4cbf-0x4cc9) plus the
// tail-call delegate into loc_4cca. loc_4cca's block copies / value formatting are
// NO LONGER loc_4cbf's.
function checkSpec(res) {
  assert.equal(res.cycles, 54, "T-state total (own instructions: 7+13+17+17)");
  assert.equal(res.flag, 0x00, "0x8048 cleared to 0 (loc_4cbf's own store at 0x4cc1)");
  assert.deepEqual(
    res.calls,
    [0x4644, 0x4d3a, 0x4cca],
    "call sequence: 0x4644, 0x4d3a, then the tail-delegate 0x4cca",
  );
  assert.equal(res.pc, SENTINEL, "tail-call: loc_4cca's ret lands on loc_4cbf's OWN caller");
  assert.equal(res.sp, 0x8780, "stack balanced (no trailing-ret double-pop)");
}

test("loc_4cbf: clears 0x8048, calls 0x4644 + 0x4d3a, delegates to loc_4cca, 54 T", () => {
  checkSpec(run(loc_4cbf));
});

// -- MUTATION: the fall-through into loc_4cca modelled as a REAL call + trailing
// `ret` (`m.call(0x4cca); m.ret()`) instead of a TAIL-call (`return m.call(0x4cca)`).
// loc_4cca's own ret already returned to loc_4cbf's caller, so the spurious ret
// double-pops: PC ends at 0x0000 (not SENTINEL), SP is 2 low, and the extra ret
// adds 10 T. All three of pc / sp / cycles reject it.
function loc_4cbf_mut(m) {
  const { regs, mem } = m;
  regs.a = 0x00;
  m.step(0x4cc1, 7);
  mem.write8(0x8048, regs.a);
  m.step(0x4cc4, 13);
  m.push16(0x4cc7);
  m.step(0x4644, 17);
  m.call(0x4644);
  m.push16(0x4cca);
  m.step(0x4d3a, 17);
  m.call(0x4d3a);
  m.step(0x4cca, 0);
  m.call(0x4cca); // BUG: not a tail-call...
  m.ret(); // ...so this spurious ret double-pops loc_4cbf's caller off the stack.
}

test("mutation (delegate as real call + trailing ret) is caught by the spec", () => {
  // Sanity: the mutant really does diverge (wrong PC + unbalanced SP + 10 T long).
  const bad = run(loc_4cbf_mut);
  assert.notEqual(bad.pc, SENTINEL, "mutant's spurious ret lands PC off the caller");
  assert.equal(bad.sp, 0x8782, "mutant double-popped -> SP is 2 high");
  assert.equal(bad.cycles, 64, "mutant's extra ret adds 10 T");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad), /caller|balanced|T-state total/);
});
