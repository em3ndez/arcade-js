// SPDX-License-Identifier: GPL-3.0-only
/**
 * hasReachedRetireLine — memory-equivalent to the frozen oracle at ROM 0x2B83.
 *
 * GATE: strict unit-capture, plus an EXHAUSTIVE input sweep, a whole-run replay of every real
 *   dispatch, and a whole-machine trace. Holes stated below.
 *
 * RAM IS NOT THE GATE HERE, and the BLIND test proves it rather than assuming it. The routine
 * writes no memory, so unitEquivalence returns `ram === null` for the correct routine, for every
 * broken twin, and for a bare no-op alike. That test asserts the tautology on purpose: if it ever
 * FAILS, the routine has started writing memory and this whole file must be re-derived.
 *
 * The real live-out is the CARRY FLAG — what every caller of this address branches on — mirrored
 * by the returned boolean. Every arm below compares BOTH. `r.equal` is never asserted: it folds
 * in the register diff that memory-equivalence deliberately drops, so it is false by design.
 *
 * What it exercises:
 *   1. EQUAL at the real dispatch — RAM identical, carry identical, and the registers allowed to
 *      differ pinned to exactly {a, f, sp} so "excluded" cannot quietly widen. The stack pointer
 *      is in that set because the layer models no stack: the frozen routine pops the return
 *      address a register-passing caller pushed and the rewrite, correctly, does not.
 *   2. CORPUS — every dispatch of a long driven run, the candidate on a clone taken at the
 *      dispatch and the frozen routine on the live machine it came from. The run is longer than
 *      ENTRY_FRAMES on purpose: entering the routine takes far fewer frames than exercising it,
 *      and the extra frames are where the true answers are.
 *   3. EXHAUSTIVE — the routine reads exactly two cells, so 256 x 256 IS its entire input space
 *      and every pair is swept. This is the arm that carries the teeth, and it is strictly
 *      stronger than the corpus: a window one pixel too wide is nearly invisible to natural
 *      dispatches, because they hardly ever land on the extra pixel.
 *   4. LEAK, EXPECTED — wiring the routine in as-is and running faults, because its callers are
 *      still register-passing and nothing pops what they push. The arm asserts the fault and
 *      records its shape, so the cost of the convention is measured rather than assumed.
 *   5. WHOLE-MACHINE — the same logic with the two dropped things handed back (the cycles, and
 *      the pop) reproduces the entire state trace byte for byte. That is what licenses "carry is
 *      the only live register": any other flag a caller read would surface here as state drift.
 *   6. TEETH — broken twins, each caught by an arm the real routine passes.
 *
 * HOLE: the sweep varies the two coordinate cells at ONE captured base pointer; the rest of the
 * machine is frozen at that entry. The corpus is what covers the other bases the game uses.
 * HOLE: the whole-machine arm runs a DIAGNOSTIC twin, not the shipped routine, and the two
 * things it hands back are exactly the two the layer drops on purpose.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2b83.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { loc_2b83 as oracle } from "../../translated/loc_2b83.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS, F_C } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x2b83;
const CORPUS_FRAMES = 2600;
const ROW_CELL = 49;
const RETIRE_COLUMN = 4;
const RETIRE_ROW = 248;
const WINDOW = 3;
const EXCLUDED = ["a", "f", "sp"];
const skip = romsPresent() ? false : "ROM images are not assembled";

let entry = null;

/** unitEquivalence with the pristine entry state harvested off the candidate arm's clone. */
function gate(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(hasReachedRetireLine);
  return entry;
}

/** Sweep the WHOLE input space: both coordinate cells, every one of the 65536 pairs. */
function sweep(candidate) {
  const columnCell = entryState().regs.iy;
  const rowCell = u16(columnCell + ROW_CELL);
  const a = entryState().clone();
  const b = entryState().clone();
  const pristine = entryState().clone().regs;
  let caught = 0;
  let retires = 0;
  for (let row = 0; row < 256; row++) {
    for (let column = 0; column < 256; column++) {
      a.regs.copyFrom(pristine);
      b.regs.copyFrom(pristine);
      a.mem8[columnCell] = column;
      a.mem8[rowCell] = row;
      b.mem8[columnCell] = column;
      b.mem8[rowCell] = row;
      oracle(a);
      const answer = candidate(b);
      if (a.regs.fC) retires++;
      if (a.regs.fC !== b.regs.fC || a.regs.fC !== (answer === true)) caught++;
    }
  }
  return { caught, retires, total: 256 * 256 };
}

/**
 * Replay every real dispatch of a driven run. The candidate runs on a clone taken at the
 * dispatch; the frozen routine runs on the live machine, which is where the host must go next.
 */
function corpus(candidate) {
  let dispatches = 0;
  let caught = 0;
  let retires = 0;
  const moved = new Set();
  const leaks = new Set();
  const host = makeMachine(
    new Map([
      [
        TARGET,
        (m) => {
          const b = m.clone();
          const answer = candidate(b);
          const proceed = oracle(m);
          dispatches++;
          if (m.regs.fC) retires++;
          leaks.add(m.regs.sp - b.regs.sp);
          const bad =
            firstStateDiff(m.dumpState(), b.dumpState()) !== null ||
            m.regs.fC !== b.regs.fC ||
            m.regs.fC !== (answer === true);
          if (bad) caught++;
          for (const k of REG_FIELDS) if (m.regs[k] !== b.regs[k]) moved.add(k);
          return proceed;
        },
      ],
    ]),
  );
  host.runFrames(CORPUS_FRAMES);
  return { dispatches, caught, retires, moved: [...moved].sort(), leaks: [...leaks] };
}

/** A whole run with the candidate wired in at the dispatch point, faults reported not thrown. */
function wireRun(candidate) {
  let dispatches = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => (dispatches++, candidate(mm))]]));
  try {
    return { frames: m.runFrames(CORPUS_FRAMES).length, dispatches, fault: m.stoppedBy };
  } catch (e) {
    return { frames: m.frames.length - 1, dispatches, fault: e };
  }
}

/**
 * The shipped logic with the two things the layer drops on purpose handed back: the cycles the
 * frozen routine charges, and the return address a register-passing caller pushed. A DIAGNOSTIC,
 * not the shipped routine — and the only form in which a whole-machine trace means anything.
 */
const CARRY_CYCLES = 34;
const FALLTHROUGH_CYCLES = 71;
function restored(m) {
  const answer = hasReachedRetireLine(m);
  m.tick(answer ? CARRY_CYCLES : FALLTHROUGH_CYCLES);
  m.ret();
  return answer;
}

// ── the arms ────────────────────────────────────────────────────────────────────────────────

test("BLIND: RAM is a TAUTOLOGY here — a bare no-op passes it too", { skip }, () => {
  const r = gate(() => {});
  assert.equal(
    r.ram,
    null,
    "a no-op DIVERGED on RAM, so this routine writes memory after all and every claim in " +
      "this file has to be re-derived from the frozen routine",
  );
  console.log("  BLIND: unitEquivalence ram === null for a no-op — RAM cannot be the gate");
});

test("EQUAL at the real dispatch: RAM and carry, with the excluded set pinned", { skip }, () => {
  const r = gate(hasReachedRetireLine);
  assert.equal(r.ram, null, "RAM diverged");
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  const answer = hasReachedRetireLine(b);

  assert.equal(b.regs.fC, a.regs.fC, "the carry live-out");
  assert.equal(answer, a.regs.fC, "the returned boolean must mirror the carry");
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape: only the accumulator, the flag byte and the stack " +
      "pointer may differ",
  );
  console.log(`  EQUAL: carry=${a.regs.fC}; only ${EXCLUDED.join(", ")} differ`);
});

test("CORPUS: every real dispatch of a driven run agrees", { skip }, () => {
  const r = corpus(hasReachedRetireLine);
  assert.ok(r.dispatches > 0, "vacuous: the routine never dispatched");
  assert.equal(r.caught, 0, `${r.caught} of ${r.dispatches} real dispatches disagreed`);
  assert.deepEqual(r.moved, EXCLUDED, "the excluded set must not widen across the corpus");
  assert.deepEqual(r.leaks, [2], "the stack difference must be the one unpopped return address");
  console.log(
    `  CORPUS: ${r.dispatches} dispatches over ${CORPUS_FRAMES} frames, ${r.retires} answered ` +
      `true; excluded ${r.moved.join(", ")}; stack ${r.leaks.join(", ")} bytes per dispatch`,
  );
});

test("EXHAUSTIVE: all 65536 coordinate pairs answer as the frozen routine does", { skip }, () => {
  const r = sweep(hasReachedRetireLine);
  assert.equal(r.caught, 0, `${r.caught} of ${r.total} input pairs disagreed`);
  assert.equal(
    r.retires,
    2 * WINDOW * 256 - WINDOW * WINDOW,
    "two windows of three across a 256-square, less the corner where they overlap",
  );
  console.log(`  EXHAUSTIVE: ${r.total} pairs identical, ${r.retires} of them answering true`);
});

test("LEAK, expected: wiring the routine in as-is faults, and this is its shape", { skip }, () => {
  const r = wireRun(hasReachedRetireLine);
  assert.notEqual(
    r.fault,
    null,
    "the run COMPLETED. That means the callers of this address no longer push a return " +
      "address for it — they have become idiomatic — so this arm has outlived its purpose " +
      "and should be deleted, not weakened",
  );
  assert.ok(r.dispatches > 0, "vacuous: the routine never dispatched");
  console.log(
    `  LEAK: an unpopped return address per dispatch; the run dies after ${r.dispatches} ` +
      `dispatches at frame ${r.frames} — ${String(r.fault).slice(0, 60)}`,
  );
});

test("WHOLE-MACHINE: hand back the cycles and the pop, and the trace matches", { skip }, () => {
  const r = wholeMachineEquivalence(makeMachine, CORPUS_FRAMES, new Map([[TARGET, restored]]));
  assert.equal(r.equal, true, `state drifted at frame ${r.frame}, address ${r.addr}`);
  assert.ok(r.invocations.get(TARGET) > 0, "vacuous: the override never fired");
  console.log(
    `  WHOLE-MACHINE: ${r.framesCompared} frames identical over ` +
      `${r.invocations.get(TARGET)} invocations — carry is the only live register`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Each twin is a plausible way to get this routine wrong, and every one of them must be caught
// by the exhaustive sweep — the same comparison the real routine passes above.

const at = (coord, line, width = WINDOW) => u8(coord - line + 1) < width;
const rowOf = (m, offset = ROW_CELL) => m.mem8[u16(m.regs.iy + offset)];
const columnOf = (m) => m.mem8[m.regs.iy];
const answerOf = (m) => at(rowOf(m), RETIRE_ROW) || at(columnOf(m), RETIRE_COLUMN);
const publish = (m, answer) => {
  m.regs.f = (m.regs.f & ~F_C) | (answer ? F_C : 0);
  return answer;
};

/** BUG: answers nothing — the tell that a gate is measuring an unreached routine. */
const brokenNoOp = () => {};
/** BUG: retires every actor on sight. */
const brokenAlwaysTrue = (m) => publish(m, true);
/** BUG: each coordinate measured against the other axis's line. */
const brokenSwappedAxes = (m) =>
  publish(m, at(rowOf(m), RETIRE_COLUMN) || at(columnOf(m), RETIRE_ROW));
/** BUG: a window one pixel too wide — invisible to any corpus of natural dispatches. */
const brokenWideWindow = (m) =>
  publish(m, at(rowOf(m), RETIRE_ROW, WINDOW + 1) || at(columnOf(m), RETIRE_COLUMN, WINDOW + 1));
/** BUG: the cell next door to the row cell. */
const brokenWrongCell = (m) =>
  publish(m, at(rowOf(m, ROW_CELL - 1), RETIRE_ROW) || at(columnOf(m), RETIRE_COLUMN));
/** BUG: right answer, never published in the flag a register-passing caller branches on. */
const brokenNoCarry = (m) => answerOf(m);
/** BUG: right flag, nothing returned to a caller that wants a value. */
const brokenNoReturn = (m) => {
  publish(m, answerOf(m));
};

const TWINS = [
  ["no-op", brokenNoOp],
  ["always-true", brokenAlwaysTrue],
  ["swapped-axes", brokenSwappedAxes],
  ["window-one-wider", brokenWideWindow],
  ["wrong-cell", brokenWrongCell],
  ["no-carry", brokenNoCarry],
  ["no-return", brokenNoReturn],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT by the exhaustive sweep`, { skip }, () => {
    const r = sweep(twin);
    assert.ok(r.caught > 0, `the sweep PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${r.total} input pairs`);
  });
}

test("TEETH: the corpus of real dispatches also catches the no-op twin", { skip }, () => {
  const r = corpus(brokenNoOp);
  assert.ok(r.caught > 0, "the corpus PASSED a no-op — it is measuring nothing");
  console.log(`  TEETH/no-op: the corpus catches ${r.caught} of ${r.dispatches} dispatches`);
});

test("TEETH: the sweep is STRICTLY stronger than the corpus on a wide window", { skip }, () => {
  const swept = sweep(brokenWideWindow).caught;
  const natural = corpus(brokenWideWindow).caught;
  assert.ok(
    swept > natural,
    "if natural dispatches caught this as often as the sweep does, the sweep would be " +
      "redundant and this file could stop claiming it is the arm with the teeth",
  );
  console.log(`  TEETH/window-one-wider: sweep catches ${swept}, natural dispatches ${natural}`);
});
