// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4f38 (ROM 0x4f38-0x4f46, The Pit): steps an object's C "column"
// index UP one step and requests sound 8. C is a cyclic index over the live range
// [0x0a, 0x23] with 0xff as the "off / not engaged" sentinel. The routine:
//   * calls loc_4c6f (sound-request-8 stub) -- which CLOBBERS A and the flags;
//   * `inc c` (step up);
//   * if the increment overflowed to 0x00 (C was the 0xff sentinel) -> `ld c,0x0a`
//     (re-enter the range from the bottom);
//   * `cp c` against 0x23 : carry set iff C > 0x23 -> `ret nc` keeps C; otherwise C
//     passed the ceiling -> `ld c,0xff` clamp sentinel, then `ret`.
//
// The UP mirror of loc_4f26 (which steps DOWN, wraps 0xff->0x23 at the top, clamps at
// the 0x09 floor). Here the overflow wrap is 0xff->0x00->0x0a and the clamp is at the
// 0x23 ceiling.
//
// Three control-flow paths are pinned against the disassembly, each with its exact
// T-state total and instruction-boundary step trace, the call target (0x4c6f) and the
// pushed return address (0x4f3b), the direct-ret, the final C and A, and the final PC:
//   * KEEP  (C=0x1f -> 0x20): jr TAKEN (no overflow), ret nc TAKEN       = 55 T
//   * WRAP  (C=0xff -> 0x0a): inc overflows to 0x00, jr NOT, ld c,0x0a   = 57 T
//   * CLAMP (C=0x24 -> 0xff): ceiling passed, ret nc NOT, ld c,0xff/ret  = 66 T
//
// The mock `call` recorder deliberately CLOBBERS A (0x99) and F (0xff) to model
// loc_4c6f's real effect, proving the routine re-establishes both (`ld a,0x23` reloads,
// `inc c` sets the Z that `jr nz` reads, and `cp c` sets the carry `ret nc` reads)
// rather than depending on the callee's leftover state. The callee's own cycles are NOT
// counted (the recorder does not invoke it), so the totals are loc_4f38-local.
//
// TEETH: a faithful twin whose ONLY break is the overflow-reset target `ld c,0x0a` ->
// `ld c,0x0b` (cycle-identical: ld c,n is 7 T either way, control flow unchanged). ONLY
// the C-value contract can reject it -- on the WRAP path the mutant lands C=0x0b not 0x0a.
//
// Run: node --test games/thepit/translated/test/loc_4f38.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4f38 } from "../loc_4f38.js";

const CALL_TARGET = 0x4c6f; // the sound-request-8 stub
const RET_ADDR = 0x4f3b; // return address pushed by `call 0x4c6f`

// Real Regs so the flag helpers (inc8 / cp) are the genuine hardware model; step /
// call / ret / push16 are recorders. `call` clobbers A and F the way loc_4c6f would,
// WITHOUT running it (its cycles are the callee's, not loc_4f38's).
function makeMachine({ c = 0x00, f = 0x00 } = {}) {
  const regs = new Regs();
  regs.c = c & 0xff;
  regs.f = f & 0xff;
  const m = {
    regs,
    cycles: 0,
    pc: 0x4f38,
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
  assert.equal(m.returned, true, "loc_4f38 always returns to its caller");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC (last step; ret does not step in this mock)");
  assert.equal(m.regs.c, exp.c, "final C (the new index)");
  assert.equal(m.regs.a, exp.a, "final A");
}

// -- KEEP: an in-range index steps up and survives ----------------------------
// C=0x1f -> inc 0x20 ; 0x20!=0 so jr taken (no overflow) ; 0x23-0x20=0x03 no borrow
// (NC) -> ret nc keeps C=0x20.
const KEEP_STEPS = [0x4c6f, 0x4f3c, 0x4f40, 0x4f42, 0x4f43];
const KEEP_CYCLES = 17 + 4 + 12 + 7 + 4 + 11; // = 55

test("keep: C=0x1f steps up to 0x20, ret nc (55 T), requests sound 8", () => {
  const m = makeMachine({ c: 0x1f });
  loc_4f38(m);
  assertPath(m, {
    steps: KEEP_STEPS,
    calls: [CALL_TARGET],
    pushes: [RET_ADDR],
    cycles: KEEP_CYCLES,
    pc: 0x4f43,
    c: 0x20,
    a: 0x23, // ld a,0x23 at 0x4f40 overwrote the callee's clobbered 0x99
  });
  assert.equal(KEEP_CYCLES, 55, "keep path is 55 T");
  console.log("  loc_4f38 keep: C 0x1f->0x20, 55 T, call [0x4c6f], push [0x4f3b]");
});

// -- WRAP: the 0xff sentinel overflows and re-enters the range from the bottom -
// C=0xff -> inc 0x00 ; 0x00==0 so jr NOT taken -> ld c,0x0a ; 0x23-0x0a=0x19 no
// borrow -> ret nc keeps C=0x0a.
const WRAP_STEPS = [0x4c6f, 0x4f3c, 0x4f3e, 0x4f40, 0x4f42, 0x4f43];
const WRAP_CYCLES = 17 + 4 + 7 + 7 + 7 + 4 + 11; // = 57

test("wrap: C=0xff (sentinel) inc overflows to 0x00 -> resets to 0x0a, ret nc (57 T)", () => {
  const m = makeMachine({ c: 0xff });
  loc_4f38(m);
  assertPath(m, {
    steps: WRAP_STEPS,
    calls: [CALL_TARGET],
    pushes: [RET_ADDR],
    cycles: WRAP_CYCLES,
    pc: 0x4f43,
    c: 0x0a,
    a: 0x23,
  });
  assert.equal(WRAP_CYCLES, 57, "wrap path is 57 T");
});

// -- CLAMP: stepping past the ceiling forces the 0xff sentinel ----------------
// C=0x24 -> inc 0x25 ; 0x25!=0 jr taken ; 0x23-0x25 borrows (carry) -> ret nc NOT
// taken -> ld c,0xff -> ret.
const CLAMP_STEPS = [0x4c6f, 0x4f3c, 0x4f40, 0x4f42, 0x4f43, 0x4f44, 0x4f46];
const CLAMP_CYCLES = 17 + 4 + 12 + 7 + 4 + 5 + 7 + 10; // = 66

test("clamp: C=0x24 passes the ceiling -> C=0xff sentinel, ret nc NOT taken (66 T)", () => {
  const m = makeMachine({ c: 0x24 });
  loc_4f38(m);
  assertPath(m, {
    steps: CLAMP_STEPS,
    calls: [CALL_TARGET],
    pushes: [RET_ADDR],
    cycles: CLAMP_CYCLES,
    pc: 0x4f46,
    c: 0xff,
    a: 0x23,
  });
  assert.equal(CLAMP_CYCLES, 66, "clamp path is 66 T");
});

// The ceiling boundary is EXACT and pinned from both sides:
//   * C=0x22 -> inc 0x23 : 0x23-0x23 = 0, NO borrow (NC) -> ret nc keeps C=0x23
//     (0x23 is the highest index that survives).
//   * C=0x23 -> inc 0x24 : 0x23-0x24 borrows -> ret nc NOT taken -> clamp to 0xff
//     (one above the keep boundary is clamped).
test("ceiling boundary: C=0x22 keeps C=0x23 (the highest surviving index)", () => {
  const m = makeMachine({ c: 0x22 });
  loc_4f38(m);
  assert.equal(m.regs.c, 0x23, "0x22 + 1 = 0x23 is at/below the ceiling -> kept");
  assert.deepEqual(m.calls, [CALL_TARGET], "still requests sound 8");
});

test("ceiling boundary: C=0x23 clamps to C=0xff (one above the keep boundary)", () => {
  const m = makeMachine({ c: 0x23 });
  loc_4f38(m);
  assert.equal(m.regs.c, 0xff, "0x23 + 1 = 0x24 is above the 0x23 ceiling -> clamped");
});

// -- TEETH --------------------------------------------------------------------
// A faithful twin of loc_4f38 with EXACTLY ONE break: the overflow-reset immediate
// `ld c,0x0a` (0e 0a) corrupted to `ld c,0x0b` (0e 0b). ld c,n is 7 T either way and
// control flow is unchanged, so the cycle total is IDENTICAL on the wrap path -- only
// the final-C contract can reject it (C = 0x0b instead of 0x0a).
function loc_4f38_mutant(m) {
  const { regs } = m;
  m.push16(0x4f3b); m.step(0x4c6f, 17); m.call(0x4c6f);
  regs.c = regs.inc8(regs.c);
  m.step(0x4f3c, 4);
  if (regs.fNZ) { m.step(0x4f40, 12); }
  else {
    m.step(0x4f3e, 7);
    regs.c = 0x0b; // BUG: ld c,0x0a -> ld c,0x0b (wrong overflow-reset target)
    m.step(0x4f40, 7);
  }
  regs.a = 0x23;
  m.step(0x4f42, 7);
  regs.cp(regs.c);
  m.step(0x4f43, 4);
  if (regs.fNC) { m.ret(11); return; }
  m.step(0x4f44, 5);
  regs.c = 0xff;
  m.step(0x4f46, 7);
  m.ret(10);
}

test("TEETH: the ld c,0x0a -> ld c,0x0b overflow-reset twin is CAUGHT by the contract", () => {
  // The real routine passes the wrap contract.
  {
    const good = makeMachine({ c: 0xff });
    loc_4f38(good);
    assertPath(good, {
      steps: WRAP_STEPS, calls: [CALL_TARGET], pushes: [RET_ADDR],
      cycles: WRAP_CYCLES, pc: 0x4f43, c: 0x0a, a: 0x23,
    });
  }
  // The mutant preserves the 57 T total but lands C one off (0x0b, not 0x0a).
  const m = makeMachine({ c: 0xff });
  loc_4f38_mutant(m);
  assert.equal(m.cycles, WRAP_CYCLES, "mutation preserves the 57 T total (cycles can't catch it)");
  assert.throws(
    () => assertPath(m, {
      steps: WRAP_STEPS, calls: [CALL_TARGET], pushes: [RET_ADDR],
      cycles: WRAP_CYCLES, pc: 0x4f43, c: 0x0a, a: 0x23,
    }),
    /final C/,
    "the contract FAILED to catch ld c,0x0a -> ld c,0x0b -- it has no teeth",
  );
  assert.equal(m.regs.c, 0x0b, "mutant: C = 0x0b (wrong overflow-reset target)");
});
