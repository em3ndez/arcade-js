// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequencePhase — memory-equivalent to the frozen oracle at ROM 0x0F11.
 *
 * GATE: strict unit-capture straight through unitEquivalence, plus an EXHAUSTIVE sweep of the
 *   FULL PRODUCT of both written cells' priors — 65536 points — on the captured entry state.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump. The entry is
 *      DRIVEN: the host replays the coin -> start tape and 0x0F11 is first entered one frame
 *      after the coin. An undriven session of 2000 frames never enters it at all, which this
 *      file MEASURES rather than assumes, because it is what makes the tape load-bearing.
 *   2. PROVENANCE — the one entry inside the driven session arrives from 0x167B, the single
 *      caller whose branch is a live state test rather than a ROM-checksum guard.
 *   3. NOT VACUOUS — the captured entry holds values that BOTH writes change, so neither write
 *      is invisible there. The no-op twin failing is the proof, and it is asserted.
 *   4. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY. Memory-equivalence drops the register
 *      trace, so `equal` is false for a CORRECT routine and only `ram` is ever asserted. The
 *      divergence is pinned to a measured subset of {a, f, h, l, sp} so it cannot quietly widen.
 *   5. EXHAUSTIVE over the product of priors, with an exact catch count per twin and the exact
 *      identity of every point a twin is allowed to agree on.
 *
 * The product sweep reuses two machines and puts every moved byte back after each point,
 * because cloning 65536 times per arm costs minutes rather than a second. That instrument is
 * CROSS-CHECKED against plain clone-per-point on 512 axis points, for a PASSING arm and a
 * FAILING one, so a leaky restore surfaces as a disagreement instead of as a silent pass.
 *
 * HOLE: one captured entry. Every cell except the two swept ones is fixed at that entry; the
 * routine reads only one of them, so the swept product still covers its whole input space.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0f11.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, COIN_START_TAPE, romsPresent } from "./_harness.js";
import { advanceSequencePhase } from "../advanceSequencePhase.js";
import { SEQUENCE_SUBSTEP } from "../names.js";
import { loc_0f11 as oracle } from "../../translated/loc_0f11.js";
import { loc_167b } from "../../translated/loc_167b.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0f11;
const LIVE_CALLER = 0x167b;
const PHASE = 0xa9ab; // the second cell advanceSequencePhase writes; it carries no registry name yet
const ATTRACT_FRAMES = 2000;
const POINTS = 256 * 256;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

let entry = null;

/** The gate itself, with the entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(advanceSequencePhase);
  return entry;
}

const toAddr = (off) => entryState().stateOffsetToAddr(off);
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const point = (phase, step) => `phase=${phase} step=${step}`;

// ── sessions ────────────────────────────────────────────────────────────────────────────
// A whole session, so "when is it entered, and by whom" is measured on a run that completed
// rather than inferred from a run that stopped somewhere unexamined.

function session(tape, frames) {
  const entries = [];
  let insideLiveCaller = false;
  const overrides = new Map([
    [
      LIVE_CALLER,
      (mm) => {
        insideLiveCaller = true;
        try {
          return loc_167b(mm);
        } finally {
          insideLiveCaller = false;
        }
      },
    ],
    [
      TARGET,
      (mm) => {
        entries.push({
          frame: mm.frames.length,
          viaLiveCaller: insideLiveCaller,
          phase: mm.mem8[PHASE],
          step: mm.mem8[SEQUENCE_SUBSTEP],
        });
        return oracle(mm);
      },
    ],
  ]);
  const m = makeMachine(overrides, { tape });
  m.runFrames(frames);
  assert.equal(m.stoppedBy, null, `the session stopped early: ${m.stoppedBy}`);
  assert.equal(m.frames.length, frames, "the session did not capture every frame it asked for");
  return entries;
}

// ── the reused-machine sweep instrument ─────────────────────────────────────────────────

/** One long-lived machine: set the two priors, run an arm, then put every moved byte back. */
class Arena {
  constructor(src) {
    this.src = src;
    this.m = src.clone();
    this.pristine = this.m.dumpState();
    this.cycles = this.m.cycles;
    this.pc = this.m.pc;
  }

  run(fn, phase, step) {
    const m = this.m;
    m.mem8[PHASE] = phase;
    m.mem8[SEQUENCE_SUBSTEP] = step;
    fn(m);
    const after = m.dumpState();
    for (let i = 0; i < after.length; i++) {
      if (after[i] !== this.pristine[i]) m.mem8[toAddr(i)] = this.pristine[i];
    }
    m.regs.copyFrom(this.src.regs);
    m.cycles = this.cycles;
    m.pc = this.pc;
    return after;
  }

  residue() {
    return firstStateDiff(this.m.dumpState(), this.pristine, toAddr);
  }
}

/** A broken instrument: it never puts the moved bytes back. */
class LeakyArena extends Arena {
  run(fn, phase, step) {
    const m = this.m;
    m.mem8[PHASE] = phase;
    m.mem8[SEQUENCE_SUBSTEP] = step;
    fn(m);
    return m.dumpState();
  }
}

/** A broken instrument: it ignores the priors it was handed and re-runs the captured ones. */
class DeafArena extends Arena {
  run(fn) {
    return super.run(fn, this.src.mem8[PHASE], this.src.mem8[SEQUENCE_SUBSTEP]);
  }
}

function makePair(Kind = Arena) {
  return { a: new Kind(entryState()), b: new Kind(entryState()) };
}

function pairDiff(pair, candidate, phase, step) {
  const da = pair.a.run(oracle, phase, step);
  const db = pair.b.run(candidate, phase, step);
  return firstStateDiff(da, db, toAddr);
}

/** Oracle vs candidate on independent clones — the slow, unimpeachable reference method. */
function cloneDiff(candidate, phase, step) {
  const a = entryState().clone();
  const b = entryState().clone();
  a.mem8[PHASE] = phase;
  a.mem8[SEQUENCE_SUBSTEP] = step;
  b.mem8[PHASE] = phase;
  b.mem8[SEQUENCE_SUBSTEP] = step;
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), toAddr);
}

/** Every prior pair, both cells 0..255. Returns the catch count and every agreeing point. */
function productSweep(candidate) {
  const pair = makePair();
  const agreements = [];
  let caught = 0;
  let firstCatch = null;
  for (let phase = 0; phase < 256; phase++) {
    for (let step = 0; step < 256; step++) {
      const d = pairDiff(pair, candidate, phase, step);
      if (d) {
        caught++;
        if (firstCatch === null) firstCatch = { phase, step, d };
      } else {
        agreements.push({ phase, step });
      }
    }
  }
  assert.equal(pair.a.residue(), null, "the oracle arena was left dirty");
  assert.equal(pair.b.residue(), null, "the candidate arena was left dirty");
  assert.equal(caught + agreements.length, POINTS, "the sweep lost points");
  return { caught, agreements, firstCatch };
}

/** The two axis lines through the captured entry — the cross-check's 512 points. */
function axisPoints() {
  const phase0 = entryState().mem8[PHASE];
  const step0 = entryState().mem8[SEQUENCE_SUBSTEP];
  const out = [];
  for (let v = 0; v < 256; v++) out.push([v, step0]);
  for (let v = 0; v < 256; v++) out.push([phase0, v]);
  return out;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: advanceSequencePhase == oracle on RAM", { skip }, () => {
  const r = gate(advanceSequencePhase);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  console.log(
    `  EQUAL: entry ${point(entryState().mem8[PHASE], entryState().mem8[SEQUENCE_SUBSTEP])} ` +
      `within ${ENTRY_FRAMES} frames; RAM identical`,
  );
});

test("PROVENANCE: one driven entry, from the live-state caller", { skip }, () => {
  const driven = session(COIN_START_TAPE, ENTRY_FRAMES);
  assert.equal(driven.length, 1, "the driven session must enter the routine exactly once");
  assert.equal(driven[0].viaLiveCaller, true, "the entry did not come from the live-state caller");
  assert.equal(driven[0].phase, entryState().mem8[PHASE], "the captured entry is that entry");
  assert.equal(driven[0].step, entryState().mem8[SEQUENCE_SUBSTEP], "the captured entry is that entry");
  console.log(
    `  PROVENANCE: entered on frame ${driven[0].frame} from ${hex4(LIVE_CALLER)}, ` +
      `${point(driven[0].phase, driven[0].step)}`,
  );
});

test("COIN-TRIGGERED: an undriven session never enters it", { skip }, () => {
  const idle = session([], ATTRACT_FRAMES);
  assert.equal(idle.length, 0, `an undriven session entered the routine ${idle.length} time(s)`);
  console.log(`  COIN-TRIGGERED: zero entries across ${ATTRACT_FRAMES} undriven frames`);
});

test("NOT VACUOUS: the captured entry makes both writes visible", { skip }, () => {
  const before = entryState().clone();
  const after = entryState().clone();
  oracle(after);
  assert.notEqual(after.mem8[PHASE], before.mem8[PHASE], "the step is invisible at this entry");
  assert.notEqual(
    after.mem8[SEQUENCE_SUBSTEP],
    before.mem8[SEQUENCE_SUBSTEP],
    "the clear is invisible at this entry — zero over zero",
  );
  assert.equal(after.mem8[SEQUENCE_SUBSTEP], 0, "the clear must store zero");
  const r = gate(() => {});
  assert.notEqual(r.ram, null, "a do-nothing arm PASSED: this gate would be a tautology");
  console.log(
    `  NOT VACUOUS: ${before.mem8[PHASE]} -> ${after.mem8[PHASE]} and ` +
      `${before.mem8[SEQUENCE_SUBSTEP]} -> ${after.mem8[SEQUENCE_SUBSTEP]}; the do-nothing arm fails`,
  );
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  advanceSequencePhase(b);

  const allowed = ["a", "f", "h", "l", "sp"];
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  for (const k of moved) {
    assert.ok(allowed.includes(k), `${k} moved: the excluded set changed shape`);
  }
  assert.deepEqual(moved, ["a", "f", "l", "sp"], "the measured excluded set changed");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.mem8[PHASE], b.mem8[PHASE], "live-out one");
  assert.equal(a.mem8[SEQUENCE_SUBSTEP], b.mem8[SEQUENCE_SUBSTEP], "live-out two");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("INSTRUMENT: the reused machine agrees with clone-per-point, passing and failing", { skip }, () => {
  const pair = makePair();
  let checked = 0;
  for (const [phase, step] of axisPoints()) {
    const goodFast = pairDiff(pair, advanceSequencePhase, phase, step);
    const goodSlow = cloneDiff(advanceSequencePhase, phase, step);
    assert.equal(goodFast, null, `${point(phase, step)} reused: ${show(goodFast)}`);
    assert.equal(goodSlow, null, `${point(phase, step)} cloned: ${show(goodSlow)}`);

    const badFast = pairDiff(pair, brokenNoOp, phase, step);
    const badSlow = cloneDiff(brokenNoOp, phase, step);
    assert.notEqual(badFast, null, `${point(phase, step)}: the reused machine missed a no-op`);
    assert.notEqual(badSlow, null, `${point(phase, step)}: clone-per-point missed a no-op`);
    assert.deepEqual(badFast, badSlow, `${point(phase, step)}: the two methods disagree`);
    checked++;
  }
  assert.equal(checked, 512, "both axis lines must be walked in full");
  assert.equal(pair.a.residue(), null, "the oracle arena was left dirty");
  assert.equal(pair.b.residue(), null, "the candidate arena was left dirty");
  console.log(`  INSTRUMENT: ${checked} axis points, both methods, same verdict and same byte`);
});

test("INSTRUMENT TEETH: a sweep machine that never restores is CAUGHT", { skip }, () => {
  const leaky = new LeakyArena(entryState());
  assert.equal(leaky.residue(), null, "a fresh sweep machine must start clean");
  leaky.run(oracle, 7, 9);
  assert.notEqual(leaky.residue(), null, "the residue check missed a machine left dirty");
  console.log(`  INSTRUMENT TEETH: unrestored machine caught — ${show(leaky.residue())}`);
});

test("INSTRUMENT TEETH: a sweep machine deaf to its priors is CAUGHT", { skip }, () => {
  const deaf = makePair(DeafArena);
  let passingArmDisagreed = 0;
  let failingArmDisagreed = 0;
  for (const [phase, step] of axisPoints()) {
    const good = pairDiff(deaf, advanceSequencePhase, phase, step);
    if (good !== null || cloneDiff(advanceSequencePhase, phase, step) !== null) passingArmDisagreed++;
    const bad = pairDiff(deaf, brokenNoOp, phase, step);
    try {
      assert.deepEqual(bad, cloneDiff(brokenNoOp, phase, step));
    } catch {
      failingArmDisagreed++;
    }
  }
  assert.equal(passingArmDisagreed, 0, "the passing arm was never going to catch this one");
  assert.equal(failingArmDisagreed, 255, "the failing arm's catch count moved");
  console.log(
    `  INSTRUMENT TEETH: deaf machine invisible to the passing arm, caught on ` +
      `${failingArmDisagreed} points by the failing one`,
  );
});

test("EXHAUSTIVE over priors: all 65536 prior pairs step and clear as the oracle does", { skip }, () => {
  const r = productSweep(advanceSequencePhase);
  assert.equal(r.caught, 0, `diverged at ${r.firstCatch && point(r.firstCatch.phase, r.firstCatch.step)}`);
  assert.equal(r.agreements.length, POINTS, "every point must agree");

  const wrapped = entryState().clone();
  wrapped.mem8[PHASE] = 255;
  advanceSequencePhase(wrapped);
  assert.equal(wrapped.mem8[PHASE], 0, "255 must round to 0, not widen to 256");
  console.log(`  EXHAUSTIVE: ${r.agreements.length} prior pairs identical, including the wrap`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin is a plausible way to get this routine wrong, and each must be caught by the SAME
// comparison the real arm passes. The agreeing points are named exactly, because a twin that
// agrees somewhere for a reason nobody wrote down is a hole rather than a result.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: steps the state byte but leaves the sub-sequence index where it stood. */
function brokenStepOnly(m) {
  const { mem8 } = m;
  mem8[PHASE] = mem8[PHASE] + 1;
}

/** BUG: restarts the sub-sequence without stepping the state byte. */
function brokenClearOnly(m) {
  const { mem8 } = m;
  mem8[SEQUENCE_SUBSTEP] = 0;
}

/** BUG: the pair read the other way round — steps the index and zeroes the state byte. */
function brokenSwapped(m) {
  const { mem8 } = m;
  mem8[SEQUENCE_SUBSTEP] = mem8[SEQUENCE_SUBSTEP] + 1;
  mem8[PHASE] = 0;
}

/** BUG: steps the state byte backwards. */
function brokenStepsBack(m) {
  const { mem8 } = m;
  mem8[PHASE] = mem8[PHASE] - 1;
  mem8[SEQUENCE_SUBSTEP] = 0;
}

const TWINS = [
  ["no-op", brokenNoOp, POINTS, []],
  ["step-only", brokenStepOnly, POINTS - 256, null],
  ["clear-only", brokenClearOnly, POINTS, []],
  ["swapped-pair", brokenSwapped, POINTS - 1, [{ phase: 255, step: 255 }]],
  ["steps-back", brokenStepsBack, POINTS, []],
];

for (const [label, twin, expected, agreeing] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT at the real dispatch`, { skip }, () => {
    const r = gate(twin);
    assert.notEqual(r.ram, null, `the gate PASSED the ${label} twin — it has no teeth`);
    assert.equal(r.equal, false, "a RAM divergence must fail the whole comparison");
    console.log(`  TEETH/${label}: caught at the entry — ${show(r.ram)}`);
  });

  test(`TEETH: the ${label} twin is CAUGHT across the whole product`, { skip }, () => {
    const r = productSweep(twin);
    assert.equal(r.caught, expected, `the sweep caught the ${label} twin on the wrong count`);
    if (agreeing === null) {
      assert.equal(r.agreements.length, 256, "the step-only twin must agree on one axis line");
      for (const a of r.agreements) {
        assert.equal(a.step, 0, `${point(a.phase, a.step)}: agreement outside the cleared line`);
      }
    } else {
      assert.deepEqual(r.agreements, agreeing, `the ${label} twin agreed somewhere unexplained`);
    }
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${POINTS} prior pairs`);
  });
}
