// SPDX-License-Identifier: GPL-3.0-only
/**
 * guardBlockOrDerailSequence — memory-equivalent to the frozen oracle at ROM 0x3252.
 *
 * ★ ONE OF THIS ROUTINE'S TWO ARMS IS UNREACHABLE ON A GENUINE IMAGE, BY DESIGN. It folds a fixed
 *   span of program space and compares the result against a constant chosen so an untouched span
 *   nets to zero; the non-zero arm therefore never fires. This gate reaches it the only way there
 *   is — by patching a PRIVATE copy of program space, identically for both arms — and asserts
 *   both that the fold really is zero on the image as shipped and that a single flipped bit sends
 *   control the other way.
 *
 * GATE: strict unit-capture on the undriven attract run, the dispatch replayed, a crafted sweep
 *   patching the guarded span at both ends and in the middle, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included.
 *   2. NOT VACUOUS — a no-op candidate fails the same diff.
 *   3. EXCLUDED, deliberately — the register divergence BOUNDED by a declared set rather than
 *      pinned to it: nothing outside the set may move, and a rewrite that leaves fewer of those
 *      registers dirty is strictly better and still passes.
 *   4. CORPUS — the dispatch the attract run produces.
 *   5. THE GUARD IS SATISFIED — the fold over the span is measured and the sum with the constant
 *      asserted to be zero, which is what makes the other arm unreachable rather than merely
 *      unobserved.
 *   6. CRAFTED, THE OTHER ARM — the same entry with one byte of the span patched, at its first
 *      address, its last, and three inside; both arms see the patch, and each is asserted to take
 *      the other route.
 *   7. THE SPAN IS EXACT — a byte one before the span and one after it are patched too, and the
 *      guard is asserted NOT to notice, which is what pins the span's two ends.
 *   8. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *   9. TEETH — six twins, each with its verdict on the genuine image and on patched ones.
 *
 * HOLE: nothing here says what the game DOES after the unreachable arm runs. It is exercised as a
 *   transfer of control and its destination's own behaviour is out of scope.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3252.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { guardBlockOrDerailSequence } from "../guardBlockOrDerailSequence.js";
import { loc_3252 as oracle } from "../../translated/loc_3252.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { advanceSequencePhase } from "../advanceSequencePhase.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "../names.js";

const TARGET = 0x3252;

const GUARDED_FROM = 0x0008;
const GUARDED_BYTES = 768;
const GUARDED_LAST = GUARDED_FROM + GUARDED_BYTES - 1;
const EXPECTED_COMPLEMENT = 0x52;

const MOVED = ["a", "f", "b", "e", "h", "l", "sp"];
const CORPUS_FRAMES = 1400;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 1;

/** Addresses inside the span, chosen at both ends and across the middle. */
const INSIDE = [GUARDED_FROM, GUARDED_FROM + 1, GUARDED_FROM + 400, GUARDED_LAST - 1, GUARDED_LAST];
const OUTSIDE = [GUARDED_FROM - 1, GUARDED_LAST + 1];

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides, { tape: [] });

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: ENTRY_FRAMES });
}

function entryState() {
  if (entry === null) gate(guardBlockOrDerailSequence);
  return entry;
}

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const caught = (candidate, machine) => unitDiff(candidate, machine) !== null;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "corpus run ran short");
  corpus = entries;
  return corpus;
}

/** The fold the guard computes, re-derived here from the machine's own program space. */
function foldOf(m) {
  let fold = 0;
  for (let i = 0; i < GUARDED_BYTES; i++) fold ^= m.mem8[GUARDED_FROM + i];
  return fold;
}

/** A real captured machine whose program space is a PRIVATE copy with one byte flipped. */
function patched(addr) {
  const m = entryState().clone();
  const copy = Uint8Array.from(m.rom);
  copy[addr] ^= 0x01;
  m.rom = copy; // what a clone is rebuilt from
  m.mem.rom = copy; // what a read goes through
  return m;
}

const insideCaught = (candidate) => INSIDE.filter((a) => caught(candidate, patched(a))).length;

// ── the shim, measured rather than asserted ─────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: never checks, and always takes the ordinary route. */
function brokenAlwaysPasses(m) {
  advanceSequenceSubStep(m);
}

/** BUG: never checks, and always takes the tamper route. */
function brokenAlwaysFails(m) {
  advanceSequencePhase(m);
}

/** BUG: the two routes are the wrong way round, which is invisible while the guard holds. */
function brokenRoutesSwapped(m) {
  if ((EXPECTED_COMPLEMENT + foldOf(m)) % 256 !== 0) advanceSequenceSubStep(m);
  else advanceSequencePhase(m);
}

/** BUG: the span stops one byte short of its end. */
function brokenSpanOneShort(m) {
  let fold = 0;
  for (let i = 0; i < GUARDED_BYTES - 1; i++) fold ^= m.mem8[GUARDED_FROM + i];
  if ((EXPECTED_COMPLEMENT + fold) % 256 !== 0) advanceSequencePhase(m);
  else advanceSequenceSubStep(m);
}

/** BUG: the span starts one byte early, so it folds a byte that is not in it. */
function brokenSpanStartsEarly(m) {
  let fold = 0;
  for (let i = 0; i < GUARDED_BYTES; i++) fold ^= m.mem8[GUARDED_FROM - 1 + i];
  if ((EXPECTED_COMPLEMENT + fold) % 256 !== 0) advanceSequencePhase(m);
  else advanceSequenceSubStep(m);
}

/** Per twin: caught on the genuine image, and how many of the patched entries catch it. */
const TWINS = [
  ["no-op", brokenNoOp, true, 5],
  ["always-passes", brokenAlwaysPasses, false, 5],
  ["always-fails", brokenAlwaysFails, true, 0],
  ["routes-swapped", brokenRoutesSwapped, true, 5],
  ["span-one-short", brokenSpanOneShort, true, 0],
  ["span-starts-early", brokenSpanStartsEarly, true, 0],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: guardBlockOrDerailSequence == oracle on the whole dump", { skip }, () => {
  const r = gate(guardBlockOrDerailSequence);
  assert.notEqual(entry, null, "vacuous: the attract run never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log("  EQUAL: every byte identical, the stack scratch included");
});

test("NOT VACUOUS: a no-op candidate FAILS the same diff", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the diff passed a candidate that does nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: scratch registers, the stack pointer and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  guardBlockOrDerailSequence(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !MOVED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: the dispatch the attract run produces replays identically", { skip }, () => {
  const entries = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(guardBlockOrDerailSequence, captured), null, "the captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatch, identical`);
});

test("THE GUARD IS SATISFIED: the fold plus the constant is zero on this image", { skip }, () => {
  const fold = foldOf(entryState());
  assert.equal(
    (EXPECTED_COMPLEMENT + fold) % 256,
    0,
    "the guard does NOT net to zero on this image, so the arm this file calls unreachable is the " +
      "one the game actually takes and every claim here has to be re-derived",
  );
  const before = entryState().mem8[SEQUENCE_SUBSTEP];
  const m = entryState().clone();
  guardBlockOrDerailSequence(m);
  assert.equal(m.mem8[SEQUENCE_SUBSTEP], (before + 1) % 256, "the ordinary route must step the index");
  console.log(`  GUARD: fold ${fold}, plus ${EXPECTED_COMPLEMENT} nets to zero; the index steps`);
});

test("CRAFTED, THE OTHER ARM: one flipped byte sends both arms the other way", { skip }, () => {
  for (const addr of INSIDE) {
    const m = patched(addr);
    assert.notEqual((EXPECTED_COMPLEMENT + foldOf(m)) % 256, 0, `${hex4(addr)}: the fold did not move`);
    assert.equal(unitDiff(guardBlockOrDerailSequence, m), null, `${hex4(addr)}: the two arms disagreed`);

    const phase = m.mem8[SEQUENCE_PHASE];
    const taken = m.clone();
    guardBlockOrDerailSequence(taken);
    assert.equal(taken.mem8[SEQUENCE_PHASE], (phase + 1) % 256, `${hex4(addr)}: the phase must step`);
    assert.equal(taken.mem8[SEQUENCE_SUBSTEP], 0, `${hex4(addr)}: and the index must restart`);
  }
  console.log(`  CRAFTED: ${INSIDE.length} patched bytes each take the unreachable route`);
});

test("THE SPAN IS EXACT: a flip either side of it changes nothing", { skip }, () => {
  for (const addr of OUTSIDE) {
    const m = patched(addr);
    assert.equal(
      (EXPECTED_COMPLEMENT + foldOf(m)) % 256,
      0,
      `${hex4(addr)}: a byte outside the span moved the fold, so the span is wider than stated`,
    );
    assert.equal(unitDiff(guardBlockOrDerailSequence, m), null, `${hex4(addr)}: the two arms disagreed`);
  }
  console.log(`  SPAN: flips at ${OUTSIDE.map(hex4).join(" and ")} leave the guard satisfied`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(guardBlockOrDerailSequence);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, guardBlockOrDerailSequence]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, onGenuine, onPatched] of TWINS) {
  test(`TEETH: the ${label} twin, on the genuine image and on patched ones`, { skip }, () => {
    assert.equal(
      caught(twin, entryState()),
      onGenuine,
      `the genuine image's view of the ${label} twin moved`,
    );
    assert.equal(insideCaught(twin), onPatched, `the ${label} twin's patched catch count moved`);
    console.log(
      `  TEETH/${label}: genuine ${onGenuine ? "catches" : "BLIND"}, patched ` +
        `${onPatched}/${INSIDE.length}`,
    );
  });
}
