// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4f26 (ROM 0x4f26-0x4f37, The Pit): steps an object's C "column"
// index DOWN one step and requests sound 8. C is a cyclic index over the live range
// [0x0a, 0x23] with 0xff as the "off / not engaged" sentinel. The routine:
//   * calls loc_4c6f (sound-request-8 stub) -- which CLOBBERS A and the flags;
//   * `dec c` (step down);
//   * if the decrement underflowed to 0xfe (C was the 0xff sentinel) -> `ld c,0x23`
//     (wrap back in from the top of the range);
//   * `cp c` against 0x09 : carry set iff C > 0x09 -> `ret c` keeps C; otherwise C
//     reached/passed the floor -> `ld c,0xff` clamp sentinel, then `ret`.
//
// Three control-flow paths are pinned against the disassembly, each with its exact
// T-state total and instruction-boundary step trace, the call target (0x4c6f) and the
// pushed return address (0x4f29), the direct-ret, the final C and A, and the final PC:
//   * KEEP  (C=0x20 -> 0x1f): jr TAKEN, ret c TAKEN            = 66 T
//   * WRAP  (C=0xff -> 0x23): dec underflows to 0xfe, jr NOT   = 68 T
//   * CLAMP (C=0x0a -> 0xff): floor reached, ret c NOT, ld/ret = 77 T
//
// The mock `call` recorder deliberately CLOBBERS A (0x99) and F (0xff) to model
// loc_4c6f's real effect, proving the routine re-establishes both (`ld a,0xfe` /
// `ld a,0x09` reloads, and the two `cp c` set the carry `ret c` actually reads) rather
// than depending on the callee's leftover state. The callee's own cycles are NOT
// counted (the recorder does not invoke it), so the totals are loc_4f26-local.
//
// TEETH: a faithful twin whose ONLY break is the wrap target `ld c,0x23` -> `ld c,0x24`
// (cycle-identical: ld c,n is 7 T either way, control flow unchanged). ONLY the C-value
// contract can reject it -- on the WRAP path the mutant lands C=0x24 instead of 0x23.
//
// Run: node --test games/thepit/translated/test/loc_4f26.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4f26 } from "../loc_4f26.js";

const CALL_TARGET = 0x4c6f; // the sound-request-8 stub
const RET_ADDR = 0x4f29; // return address pushed by `call 0x4c6f`

// Real Regs so the flag helpers (dec8 / cp) are the genuine hardware model; step /
// call / ret / push16 are recorders. `call` clobbers A and F the way loc_4c6f would,
// WITHOUT running it (its cycles are the callee's, not loc_4f26's).
function makeMachine({ c = 0x00, f = 0x00 } = {}) {
  const regs = new Regs();
  regs.c = c & 0xff;
  regs.f = f & 0xff;
  const m = {
    regs,
    cycles: 0,
    pc: 0x4f26,
    steps: [],
    calls: [],
    pushes: [],
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.cycles += cycles;
      this.steps.push(addr);
    },
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      regs.a = 0x99; // loc_4c6f overwrites A (with the sound index) ...
      regs.f = 0xff; // ... and the flags -- the routine must not rely on either
      return undefined;
    },
    push16(value) {
      this.pushes.push(value);
    },
  };
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets (instruction boundaries)");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.deepEqual(m.pushes, exp.pushes, "pushed return addresses");
  assert.equal(m.returned, true, "loc_4f26 always returns to its caller");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC (last step; ret does not step in this mock)");
  assert.equal(m.regs.c, exp.c, "final C (the new index)");
  assert.equal(m.regs.a, exp.a, "final A");
}

// -- KEEP: an in-range index steps down and survives --------------------------
// C=0x20 -> dec 0x1f ; 0xfe!=0x1f so jr taken (no wrap) ; 0x09-0x1f borrows so
// carry set -> ret c keeps C=0x1f.
const KEEP_STEPS = [0x4c6f, 0x4f2a, 0x4f2c, 0x4f2d, 0x4f31, 0x4f33, 0x4f34];
const KEEP_CYCLES = 17 + 4 + 7 + 4 + 12 + 7 + 4 + 11; // = 66

test("keep: C=0x20 steps down to 0x1f, ret c (66 T), requests sound 8", () => {
  const m = makeMachine({ c: 0x20 });
  loc_4f26(m);
  assertPath(m, {
    steps: KEEP_STEPS,
    calls: [CALL_TARGET],
    pushes: [RET_ADDR],
    cycles: KEEP_CYCLES,
    pc: 0x4f34,
    c: 0x1f,
    a: 0x09, // ld a,0x09 at 0x4f31 overwrote the callee's clobbered 0x99
  });
  assert.equal(KEEP_CYCLES, 66, "keep path is 66 T");
  console.log("  loc_4f26 keep: C 0x20->0x1f, 66 T, call [0x4c6f], push [0x4f29]");
});

// -- WRAP: the 0xff sentinel re-enters the range from the top -----------------
// C=0xff -> dec 0xfe ; 0xfe==0xfe so jr NOT taken -> ld c,0x23 ; 0x09-0x23 borrows
// -> ret c keeps C=0x23.
const WRAP_STEPS = [0x4c6f, 0x4f2a, 0x4f2c, 0x4f2d, 0x4f2f, 0x4f31, 0x4f33, 0x4f34];
const WRAP_CYCLES = 17 + 4 + 7 + 4 + 7 + 7 + 7 + 4 + 11; // = 68

test("wrap: C=0xff (sentinel) dec underflows to 0xfe -> resets to 0x23, ret c (68 T)", () => {
  const m = makeMachine({ c: 0xff });
  loc_4f26(m);
  assertPath(m, {
    steps: WRAP_STEPS,
    calls: [CALL_TARGET],
    pushes: [RET_ADDR],
    cycles: WRAP_CYCLES,
    pc: 0x4f34,
    c: 0x23,
    a: 0x09,
  });
  assert.equal(WRAP_CYCLES, 68, "wrap path is 68 T");
});

// -- CLAMP: stepping to/through the floor forces the 0xff sentinel ------------
// C=0x0a -> dec 0x09 ; 0xfe!=0x09 jr taken ; 0x09-0x09 = 0, NO borrow (NC) ->
// ret c NOT taken -> ld c,0xff -> ret. 0x0a is the lowest entry that clamps
// (0x0b would keep 0x0a), so it pins the floor boundary exactly.
const CLAMP_STEPS = [0x4c6f, 0x4f2a, 0x4f2c, 0x4f2d, 0x4f31, 0x4f33, 0x4f34, 0x4f35, 0x4f37];
const CLAMP_CYCLES = 17 + 4 + 7 + 4 + 12 + 7 + 4 + 5 + 7 + 10; // = 77

test("clamp: C=0x0a hits the floor -> C=0xff sentinel, ret c NOT taken (77 T)", () => {
  const m = makeMachine({ c: 0x0a });
  loc_4f26(m);
  assertPath(m, {
    steps: CLAMP_STEPS,
    calls: [CALL_TARGET],
    pushes: [RET_ADDR],
    cycles: CLAMP_CYCLES,
    pc: 0x4f37,
    c: 0xff,
    a: 0x09,
  });
  assert.equal(CLAMP_CYCLES, 77, "clamp path is 77 T");
});

// The floor boundary is EXACT: one above (0x0b) survives as 0x0a, not clamped.
test("floor boundary: C=0x0b keeps C=0x0a (just above the floor, ret c taken)", () => {
  const m = makeMachine({ c: 0x0b });
  loc_4f26(m);
  assert.equal(m.regs.c, 0x0a, "0x0b - 1 = 0x0a is above the 0x09 floor -> kept");
  assert.deepEqual(m.calls, [CALL_TARGET], "still requests sound 8");
});

// -- TEETH --------------------------------------------------------------------
// A faithful twin of loc_4f26 with EXACTLY ONE break: the wrap target immediate
// `ld c,0x23` (0e 23) corrupted to `ld c,0x24` (0e 24). ld c,n is 7 T either way
// and control flow is unchanged, so the cycle total is IDENTICAL on the wrap path
// -- only the final-C contract can reject it (C = 0x24 instead of 0x23).
function loc_4f26_mutant(m) {
  const { regs } = m;
  m.push16(0x4f29); m.step(0x4c6f, 17); m.call(0x4c6f);
  regs.c = regs.dec8(regs.c);
  m.step(0x4f2a, 4);
  regs.a = 0xfe;
  m.step(0x4f2c, 7);
  regs.cp(regs.c);
  m.step(0x4f2d, 4);
  if (regs.fNZ) { m.step(0x4f31, 12); }
  else {
    m.step(0x4f2f, 7);
    regs.c = 0x24; // BUG: ld c,0x23 -> ld c,0x24 (wrong wrap target)
    m.step(0x4f31, 7);
  }
  regs.a = 0x09;
  m.step(0x4f33, 7);
  regs.cp(regs.c);
  m.step(0x4f34, 4);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x4f35, 5);
  regs.c = 0xff;
  m.step(0x4f37, 7);
  m.ret(10);
}

test("TEETH: the ld c,0x23 -> ld c,0x24 wrap-target twin is CAUGHT by the contract", () => {
  // The real routine passes the wrap contract.
  {
    const good = makeMachine({ c: 0xff });
    loc_4f26(good);
    assertPath(good, {
      steps: WRAP_STEPS, calls: [CALL_TARGET], pushes: [RET_ADDR],
      cycles: WRAP_CYCLES, pc: 0x4f34, c: 0x23, a: 0x09,
    });
  }
  // The mutant preserves the 68 T total but lands C one off (0x24, not 0x23).
  const m = makeMachine({ c: 0xff });
  loc_4f26_mutant(m);
  assert.equal(m.cycles, WRAP_CYCLES, "mutation preserves the 68 T total (cycles can't catch it)");
  assert.throws(
    () => assertPath(m, {
      steps: WRAP_STEPS, calls: [CALL_TARGET], pushes: [RET_ADDR],
      cycles: WRAP_CYCLES, pc: 0x4f34, c: 0x23, a: 0x09,
    }),
    /final C/,
    "the contract FAILED to catch ld c,0x23 -> ld c,0x24 -- it has no teeth",
  );
  assert.equal(m.regs.c, 0x24, "mutant: C = 0x24 (wrong wrap target)");
});
