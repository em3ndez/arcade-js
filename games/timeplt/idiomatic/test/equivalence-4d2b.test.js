// SPDX-License-Identifier: GPL-3.0-only
/**
 * isScoreBelow — memory-equivalent to the frozen oracle at ROM 0x4D2B.
 *
 * WHAT IT IS. The routine writes NOTHING. Its whole product is one bit — the carry it leaves
 * behind — so a RAM comparison here cannot fail, and a gate built only on RAM would pass a
 * candidate that answered the opposite question on every input. Every arm below therefore asserts
 * the ANSWER, and the RAM-only verdict on each twin is recorded as blind rather than left implied.
 *
 * GATE: strict unit-capture replayed over every dispatch of the shared coin -> start tape, plus an
 *   exhaustive crafted sweep over each of the three byte positions in turn, plus teeth.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at the real dispatch — RAM identical, the stack included, AND the carry identical.
 *      The exclusion window is measured at ZERO bytes and asserted so.
 *   2. THE ANSWER IS THE PRODUCT — one arm shows the RAM comparison passing all five twins, and
 *      the carry comparison catching them.
 *   3. THE RETURN AND THE CARRY AGREE — the rewrite hands the answer back as a value as well as
 *      leaving it in the flag, and the two are asserted equal on every crafted entry.
 *   4. EXCLUDED, deliberately — the register set that may differ is BOUNDED, not pinned: nothing
 *      outside it may diverge, and a rewrite that moves one FEWER register still passes. The
 *      flag byte is IN that set because the rewrite reproduces only the carry bit of it, which is
 *      the reason arm 1 asserts carry rather than the whole byte.
 *   5. CORPUS — every dispatch of the session replayed on a clone.
 *   6. EXHAUSTIVE — three sweeps of 256, one per byte position, each with the other two positions
 *      equal; four CROSSED pairs in which two positions disagree, which is the only thing that
 *      can tell the ordering apart from its reverse; and an all-equal case, which is the only way
 *      the routine reaches its answer by falling out of the loop.
 *   7. TEETH — five twins with exact catch counts.
 *
 * HOLE: apart from the four crossed pairs, the sweeps vary ONE position at a time against equal
 * neighbours, so the crossed pairs are carrying the whole of the ordering claim — and the twin
 * that reads least significant first is caught on those four entries and nowhere else, which the
 * per-twin count states rather than leaving to be discovered.
 * HOLE: nothing here says what the three bytes MEAN. The gate fixes the comparison, its direction
 * and its tie-breaking.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4d2b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { isScoreBelow } from "../isScoreBelow.js";
import { loc_4d2b as oracle } from "../../translated/loc_4d2b.js";
import { REG_FIELDS, F_C } from "../../../../core/cpu/z80.js";

const TARGET = 0x4d2b;
const FRAMES = 3000;
const DISPATCHES = 5;

const BYTES = 3;
/** Two three-byte scratch runs inside work RAM the game is not using this frame. */
const CANDIDATE_RUN = 0xafa2;
const STANDING_RUN = 0xafa8;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["f", "c", "sp"];

const VALUES = Array.from({ length: 256 }, (_unused, i) => i);
const NEUTRAL = 0x40;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const carry = (m) => (m.regs.f & F_C) !== 0;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inScratch = (addr, sp) => addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;

/** The RAM-only verdict, kept separate so its blindness can be asserted. */
function ramDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

/** RAM first, then the answer. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const stray = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (stray) return stray;
  if (carry(a) !== carry(b)) return { addr: null, a: Number(carry(a)), b: Number(carry(b)) };
  return null;
}

let entry = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const answers = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    const sp = mm.regs.sp;
    const b = mm.clone();
    candidate(b);
    const r = oracle(mm);
    answers.add(carry(mm));
    if (allDiffs(mm, b).some((d) => !inScratch(d.addr, sp))) caught++;
    else if (carry(mm) !== carry(b)) caught++;
    return r;
  }]]));
  const frames = host.runFrames(FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "session ran short");
  return { dispatches, caught, answers };
}

function entryState() {
  if (entry === null) replay(isScoreBelow);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/**
 * A real captured machine with two three-byte runs planted in unused work RAM and the two
 * pointers aimed at their most significant bytes, which is the end the routine starts from.
 */
function craft(candidateBytes, standingBytes) {
  const m = entryState().clone();
  for (let i = 0; i < BYTES; i++) {
    m.mem8[CANDIDATE_RUN + i] = candidateBytes[i];
    m.mem8[STANDING_RUN + i] = standingBytes[i];
  }
  m.regs.de = CANDIDATE_RUN + BYTES - 1;
  m.regs.hl = STANDING_RUN + BYTES - 1;
  return m;
}

/** The three-byte runs a sweep over ONE position produces, the other two positions equal. */
function atPosition(position, value) {
  const mine = [NEUTRAL, NEUTRAL, NEUTRAL];
  const theirs = [NEUTRAL, NEUTRAL, NEUTRAL];
  mine[position] = value;
  return [mine, theirs];
}

/**
 * Four pairs in which TWO positions differ and point opposite ways, so the most significant one
 * has to win. A sweep that varies one position at a time cannot tell an ordering apart from its
 * reverse; these can, and the twin that reads the wrong end is caught only here.
 */
const CROSS = [
  [[NEUTRAL + 1, NEUTRAL, NEUTRAL - 1], [NEUTRAL, NEUTRAL, NEUTRAL]],
  [[NEUTRAL - 1, NEUTRAL, NEUTRAL + 1], [NEUTRAL, NEUTRAL, NEUTRAL]],
  [[NEUTRAL, NEUTRAL + 1, NEUTRAL - 1], [NEUTRAL, NEUTRAL, NEUTRAL]],
  [[NEUTRAL, NEUTRAL - 1, NEUTRAL + 1], [NEUTRAL, NEUTRAL, NEUTRAL]],
];

function sweepCaught(candidate, diff = unitDiff) {
  let caught = 0;
  for (let position = 0; position < BYTES; position++) {
    for (const value of VALUES) {
      if (diff(candidate, craft(...atPosition(position, value)))) caught++;
    }
  }
  for (const [mine, theirs] of CROSS) if (diff(candidate, craft(mine, theirs))) caught++;
  if (diff(candidate, craft([NEUTRAL, NEUTRAL, NEUTRAL], [NEUTRAL, NEUTRAL, NEUTRAL]))) caught++;
  return caught;
}

const SWEEP_SIZE = BYTES * VALUES.length + CROSS.length + 1;

// ── twins ───────────────────────────────────────────────────────────────────────────────

function answer(m, below) {
  m.regs.f = (m.regs.f & ~F_C) | (below ? F_C : 0);
  return below;
}

function compare(m, bytes, ascending, equalIsBelow) {
  const { mem8, regs } = m;
  for (let i = 0; i < bytes; i++) {
    const step = ascending ? -(bytes - 1) + i : -i;
    const mine = mem8[(regs.de + step) & 0xffff];
    const theirs = mem8[(regs.hl + step) & 0xffff];
    if (mine !== theirs) return answer(m, mine < theirs);
  }
  return answer(m, equalIsBelow);
}

/** BUG: does nothing at all, so the caller reads whatever the flag happened to hold. */
function brokenNoOp() {}

/** BUG: always answers the same way. */
function brokenAlwaysBelow(m) {
  return answer(m, true);
}

/** BUG: reads the three bytes least significant first, so the ordering is decided by the wrong end. */
function brokenAscending(m) {
  return compare(m, BYTES, true, false);
}

/** BUG: reads two bytes, so a difference in the third is invisible. */
function brokenTwoBytes(m) {
  return compare(m, 2, false, false);
}

/** BUG: counts all three equal as below, so an exact tie answers the other way. */
function brokenEqualIsBelow(m) {
  return compare(m, BYTES, false, true);
}

/**
 * Each twin's exact catch count over the crafted sweep, and whether the RAM-only comparison sees
 * it. It never does: this routine writes no memory at all, which is the point of arm 2.
 */
const TWINS = [
  ["no-op", brokenNoOp, 194, false],
  ["always-below", brokenAlwaysBelow, 579, false],
  ["least-significant-first", brokenAscending, 4, false],
  ["two-bytes", brokenTwoBytes, 64, false],
  ["equal-counts-as-below", brokenEqualIsBelow, 4, false],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM and the carry both agree", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  isScoreBelow(b);
  assert.deepEqual(allDiffs(a, b), [], "no byte of the dump may differ; this entry writes none");
  assert.equal(carry(a), carry(b), "the answer");
  console.log(`  EQUAL: carry=${carry(a)}, no byte differs`);
});

test("THE ANSWER IS THE PRODUCT: a RAM-only gate is BLIND to every twin here", { skip }, () => {
  for (const [label, twin] of TWINS) {
    assert.equal(sweepCaught(twin, ramDiff), 0,
      `the ${label} twin moved memory, so this entry no longer writes nothing`);
  }
  const d = unitDiff(brokenAlwaysBelow, craft([NEUTRAL + 1, NEUTRAL, NEUTRAL], [NEUTRAL, NEUTRAL, NEUTRAL]));
  assert.notEqual(d, null, "a wrong answer must be caught");
  assert.equal(d.addr, null, "and it must be caught on the answer, not on a cell");
  console.log(`  PRODUCT: RAM sees none of the five twins; the carry sees them — ${show(d)}`);
});

test("THE RETURN AND THE CARRY AGREE on every crafted entry", { skip }, () => {
  let checked = 0;
  for (let position = 0; position < BYTES; position++) {
    for (const value of VALUES) {
      const m = craft(...atPosition(position, value));
      const returned = isScoreBelow(m);
      assert.equal(typeof returned, "boolean", "the rewrite must hand the answer back");
      assert.equal(returned, carry(m), `position ${position} value ${value}: return vs carry`);
      checked++;
    }
  }
  console.log(`  RETURN: ${checked} crafted entries, return and carry agree on each`);
});

test("EXCLUDED, deliberately: no register diverges outside the declared set", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  isScoreBelow(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.ok(EXCLUDED.includes("f"), "the flag byte differs in bits other than carry, and must " +
    "stay declared — which is why the carry is compared on its own above");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real session replays identically", { skip }, () => {
  const r = replay(isScoreBelow);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  console.log(`  CORPUS: ${r.dispatches} dispatches, answers ${[...r.answers].join("/")}`);
});

test("EXHAUSTIVE: each byte position swept, and the all-equal case", { skip }, () => {
  assert.equal(sweepCaught(isScoreBelow), 0, "the rewrite diverged somewhere in the crafted space");
  const tie = craft([NEUTRAL, NEUTRAL, NEUTRAL], [NEUTRAL, NEUTRAL, NEUTRAL]);
  assert.equal(isScoreBelow(tie), false, "three equal bytes must answer NOT below");
  const high = craft([NEUTRAL, NEUTRAL, NEUTRAL - 1], [NEUTRAL, NEUTRAL, NEUTRAL]);
  assert.equal(isScoreBelow(high), true, "a smaller most significant byte must answer below");
  const low = craft([NEUTRAL - 1, NEUTRAL, NEUTRAL], [NEUTRAL, NEUTRAL, NEUTRAL]);
  assert.equal(isScoreBelow(low), true, "a smaller least significant byte must answer below");
  const outranks = craft([0x00, 0x00, NEUTRAL + 1], [0xff, 0xff, NEUTRAL]);
  assert.equal(isScoreBelow(outranks), false, "the most significant byte must outrank the other two");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} crafted entries identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught, ramSees] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    assert.equal(sweepCaught(twin, ramDiff) > 0, ramSees, `the RAM verdict on ${label} changed`);
    console.log(
      `  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE}; ` +
        `RAM alone is ${ramSees ? "enough" : "BLIND, as recorded"}`,
    );
  });
}
