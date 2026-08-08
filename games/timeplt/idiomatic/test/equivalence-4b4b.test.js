// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawRandomByte — memory-equivalent to the frozen oracle at ROM 0x4B4B.
 *
 * GATE: strict unit-capture on the coin-and-start tape, every captured dispatch replayed, an
 *   exhaustive sweep of the frame counter, a crafted sweep of the shift-register contents, a
 *   whole-machine replay, and teeth. RAM IS A REAL GATE: the routine rewrites seventeen bytes and
 *   the NOT VACUOUS arm proves a do-nothing candidate fails on RAM at the real dispatch.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included, plus the
 *      drawn byte, which is compared as a live-out and not excluded.
 *   2. NOT VACUOUS — a no-op candidate fails the same diff.
 *   3. EXCLUDED, deliberately — nothing diverges outside the declared set, which is an upper bound
 *      and not a pin: a rewrite that leaves one MORE register alone passes. The set is almost
 *      entirely the ALTERNATE register set, which the original swaps in to do its work and the
 *      rewrite never touches; the whole-machine arm is what says that is dead rather than merely
 *      unread here.
 *   4. CORPUS — every dispatch the tape produces.
 *   5. EXHAUSTIVE COUNTER — all 256 values of the counter the drawn byte is offset by.
 *   6. CRAFTED REGISTER — the seventeen bytes forced to patterns that make the two taps agree,
 *      disagree, and sit at both extremes, so the feedback is exercised rather than observed.
 *   7. THE DRAW ADVANCES THE STATE — two draws in a row are asserted to differ from one, which is
 *      what makes this a generator rather than a lookup.
 *   8. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *   9. TEETH — eight twins, each caught on exact declared counts.
 *
 * HOLE: nothing here says the sequence is GOOD. Period, distribution and correlation are not
 *   measured; every arm asks only whether the rewrite reproduces the original's next byte.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4b4b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { drawRandomByte } from "../drawRandomByte.js";
import { loc_4b4b as oracle } from "../../translated/loc_4b4b.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { FRAME_TICK, RANDOM_REGISTER } from "../names.js";

const TARGET = 0x4b4b;

const REGISTER_BYTES = 17;
const FIRST_TAP = 7;
const SECOND_TAP = 16;

const MOVED = ["f", "sp", "b_", "c_", "d_", "e_", "h_", "l_"];
const CORPUS_FRAMES = 1400;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 14;

const COUNTERS = Array.from({ length: 256 }, (_unused, c) => c);

/** Register fills: all-zero, all-ones, and three that make the two taps differ. */
const PATTERNS = [
  () => 0x00,
  () => 0xff,
  (i) => i,
  (i) => 0xff - i,
  (i) => (i * 37 + 11) & 0xff,
  (i) => (i === FIRST_TAP - 1 || i === SECOND_TAP - 1 ? 0xff : 0x00),
];

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides);

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: ENTRY_FRAMES });
}

function entryState() {
  if (entry === null) gate(drawRandomByte);
  return entry;
}

/** Oracle vs candidate on clones: RAM first, then the drawn byte. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  return a.regs.a === b.regs.a ? null : { addr: null, a: a.regs.a, b: b.regs.a };
}

const caught = (candidate, machine) => unitDiff(candidate, machine) !== null;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const counters = new Set();
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    counters.add(mm.mem8[FRAME_TICK]);
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "corpus run ran short");
  corpus = { entries, counters };
  return corpus;
}

const withCounter = (value) => {
  const m = entryState().clone();
  m.mem8[FRAME_TICK] = value;
  return m;
};

function withPattern(fill) {
  const m = entryState().clone();
  for (let i = 0; i < REGISTER_BYTES; i++) m.mem8[RANDOM_REGISTER + i] = fill(i);
  return m;
}

const counterCaught = (candidate) => COUNTERS.filter((c) => caught(candidate, withCounter(c))).length;
const patternCaught = (candidate) => PATTERNS.filter((p) => caught(candidate, withPattern(p))).length;

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

function shift(m) {
  for (let i = REGISTER_BYTES - 1; i > 0; i--) {
    m.mem8[RANDOM_REGISTER + i] = m.mem8[RANDOM_REGISTER + i - 1];
  }
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: never advances the register, so the same byte comes out until the counter moves. */
function brokenNoShift(m) {
  const feedback = m.mem8[RANDOM_REGISTER + FIRST_TAP] ^ m.mem8[RANDOM_REGISTER + SECOND_TAP];
  m.mem8[RANDOM_REGISTER] = feedback;
  m.regs.a = (feedback + m.mem8[FRAME_TICK]) & 0xff;
  return m.regs.a;
}

/** BUG: takes the taps BEFORE the shift instead of after, so the feedback is one draw stale. */
function brokenTapsBeforeShift(m) {
  const feedback = m.mem8[RANDOM_REGISTER + FIRST_TAP] ^ m.mem8[RANDOM_REGISTER + SECOND_TAP];
  shift(m);
  m.mem8[RANDOM_REGISTER] = feedback;
  m.regs.a = (feedback + m.mem8[FRAME_TICK]) & 0xff;
  return m.regs.a;
}

/** BUG: one tap is a place out, which is the smallest wrong feedback there is. */
function brokenTapOffByOne(m) {
  shift(m);
  const feedback = m.mem8[RANDOM_REGISTER + FIRST_TAP + 1] ^ m.mem8[RANDOM_REGISTER + SECOND_TAP];
  m.mem8[RANDOM_REGISTER] = feedback;
  m.regs.a = (feedback + m.mem8[FRAME_TICK]) & 0xff;
  return m.regs.a;
}

/** BUG: the register is one byte short, so the last place never joins the chain. */
function brokenShortRegister(m) {
  for (let i = REGISTER_BYTES - 2; i > 0; i--) {
    m.mem8[RANDOM_REGISTER + i] = m.mem8[RANDOM_REGISTER + i - 1];
  }
  const feedback = m.mem8[RANDOM_REGISTER + FIRST_TAP] ^ m.mem8[RANDOM_REGISTER + SECOND_TAP];
  m.mem8[RANDOM_REGISTER] = feedback;
  m.regs.a = (feedback + m.mem8[FRAME_TICK]) & 0xff;
  return m.regs.a;
}

/** BUG: hands back the feedback alone, so draws in one frame stop depending on the moment. */
function brokenNoCounter(m) {
  shift(m);
  const feedback = m.mem8[RANDOM_REGISTER + FIRST_TAP] ^ m.mem8[RANDOM_REGISTER + SECOND_TAP];
  m.mem8[RANDOM_REGISTER] = feedback;
  m.regs.a = feedback;
  return m.regs.a;
}

/** BUG: combines the taps by addition rather than exclusive-or. */
function brokenAddsTaps(m) {
  shift(m);
  const feedback = (m.mem8[RANDOM_REGISTER + FIRST_TAP] + m.mem8[RANDOM_REGISTER + SECOND_TAP]) & 0xff;
  m.mem8[RANDOM_REGISTER] = feedback;
  m.regs.a = (feedback + m.mem8[FRAME_TICK]) & 0xff;
  return m.regs.a;
}

/** BUG: advances the register correctly and hands back nothing, which RAM cannot see. */
function brokenNoResult(m) {
  shift(m);
  const feedback = m.mem8[RANDOM_REGISTER + FIRST_TAP] ^ m.mem8[RANDOM_REGISTER + SECOND_TAP];
  m.mem8[RANDOM_REGISTER] = feedback;
}

/** Per twin: catches over the counter sweep, over the register patterns, and at the dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 256, 6, true],
  ["no-shift", brokenNoShift, 256, 4, true],
  ["taps-before-shift", brokenTapsBeforeShift, 256, 3, true],
  ["tap-off-by-one", brokenTapOffByOne, 256, 4, true],
  ["short-register", brokenShortRegister, 256, 4, true],
  ["no-counter", brokenNoCounter, 255, 6, true],
  ["adds-taps", brokenAddsTaps, 256, 5, true],
  ["no-result", brokenNoResult, 255, 6, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM and the drawn byte both identical", { skip }, () => {
  const r = gate(drawRandomByte);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.equal(unitDiff(drawRandomByte, entryState()), null, "the drawn byte diverged");
  console.log("  EQUAL: seventeen shifted bytes and the drawn byte agree");
});

test("NOT VACUOUS: a no-op candidate FAILS the same diff", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "and it must be caught on a real cell, not on the drawn byte alone");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: the alternate register set, the flags, the pointer and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  drawRandomByte(b);
  // What this catches: the drawn byte disagreeing, or the MAIN register set being touched on
  // either arm — the original's pair of set swaps is what buys it that.
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !MOVED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, counters } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(drawRandomByte, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches over ${counters.size} counter values`);
});

test("EXHAUSTIVE: all 256 counter values give the same drawn byte as the oracle", { skip }, () => {
  for (const c of COUNTERS) {
    const d = unitDiff(drawRandomByte, withCounter(c));
    assert.equal(d, null, `counter ${c}: ${show(d)}`);
  }
  console.log(`  EXHAUSTIVE: ${COUNTERS.length} counter values identical`);
});

test("CRAFTED: every register pattern shifts and feeds back identically", { skip }, () => {
  for (const p of PATTERNS) {
    const d = unitDiff(drawRandomByte, withPattern(p));
    assert.equal(d, null, `pattern: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${PATTERNS.length} register patterns identical`);
});

test("THE DRAW ADVANCES THE STATE: a second draw differs from the first", { skip }, () => {
  const m = withPattern(PATTERNS[4]);
  const first = drawRandomByte(m);
  const second = drawRandomByte(m);
  assert.notEqual(
    first,
    second,
    "two draws in a row from one machine gave the same byte, so the register is NOT the state and " +
      "this routine is a lookup rather than a generator",
  );
  const o = withPattern(PATTERNS[4]);
  oracle(o);
  assert.equal(o.regs.a, first, "and the oracle's first draw must be the same byte");
  console.log(`  ADVANCES: consecutive draws ${first} then ${second}`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(drawRandomByte);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short");
  assert.equal(
    w.equal,
    true,
    `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)} — if this is the alternate register set, ` +
      "the excluded set above is wrong and those registers are live after all",
  );
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, WHOLE_FRAMES, new Map([[TARGET, drawRandomByte]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, counters, patterns, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exact counts of both sweeps`, { skip }, () => {
    assert.equal(counterCaught(twin), counters, `the ${label} twin's counter catch count moved`);
    assert.equal(patternCaught(twin), patterns, `the ${label} twin's pattern catch count moved`);
    console.log(`  TEETH/${label}: counters ${counters}/256, patterns ${patterns}/${PATTERNS.length}`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    assert.equal(
      caught(twin, entryState()),
      seenAtDispatch,
      `the real dispatch's view of the ${label} twin moved`,
    );
    console.log(`  TEETH/${label}: real dispatch ${seenAtDispatch ? "catches it" : "is BLIND"}`);
  });
}
