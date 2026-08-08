// SPDX-License-Identifier: GPL-3.0-only
/**
 * headingToward — memory-equivalent to the frozen oracle at ROM 0x33B8.
 *
 * GATE: unit-capture judged by a MASKED RAM diff plus a declared live-out comparison, a replayed
 *   corpus of every dispatch from two sessions, an EXHAUSTIVE sweep of the routine's entire input
 *   space, and teeth.
 *
 *   THE ONE EXCLUSION is the dead stack scratch: the frozen routine reaches its table lookups
 *   through calls, so the two bytes just below the entry stack pointer can hold a return slot the
 *   rewrite never writes. The window is exactly [SP-2, SP) and every arm PINS it.
 *
 *   THE ANSWER, NOT THE MEMORY, IS THE CONTRACT. This routine writes no cell, so RAM alone would
 *   pass a candidate that answered differently every time. The blind arm measures that.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — identical outside the window, and the answer identical.
 *   2. RAM IS BLIND — measured with a twin that answers one out and moves no byte.
 *   3. CORPUS — every dispatch of a driven and an undriven session, counts asserted.
 *   4. EXCLUDED — the register divergence BOUNDED by a declared set rather than pinned to it:
 *      nothing outside the set may move, and a rewrite that leaves fewer of those registers dirty
 *      is strictly better and still passes. The accumulator holding the heading is OUTSIDE the
 *      set, so the live-out still cannot move. The ALTERNATE accumulator is inside it
 *      deliberately: the frozen routine parks a copy of one leg there and nothing reads it back,
 *      so the rewrite drops the copy — but the rest of the alternate bank stays watched.
 *   5. EXHAUSTIVE — the input space is two coordinate bytes of the object against two of the
 *      point, but only the DIFFERENCES matter, so it is covered by fixing each of the object's
 *      coordinates at both ends of its range and sweeping both of the point's over 0..255: every
 *      combination of sign and magnitude on both axes, 262144 points in all.
 *   6. CROSS-CHECK — the exhaustive arm reuses two machines rather than cloning, so a separate
 *      arm re-runs a sample with clone-per-point whole-dump comparison.
 *   7. TEETH — six twins, each caught on an exact count of the swept points, and the counts are
 *      the shape of the routine rather than a score: the diagonal twin is caught on 514 points
 *      because only the equal-legs cases reach the short table at all, and the backwards twin on
 *      almost exactly half because half the sectors count forwards anyway.
 *
 * HOLE: the sweep leaves the point's ADDRESS where the captured dispatch had it, so the low-byte
 * wrap that reads the second coordinate is exercised only at that address. The corpus arm covers
 * seven distinct addresses, none of which sits on a page boundary, so the wrap itself is not
 * exercised by anything here.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-33b8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { headingToward } from "../headingToward.js";
import { loc_33b8 as oracle } from "../../translated/loc_33b8.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x33b8;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const SCRATCH_BYTES = 2;
const FIRST_COORDINATE = 0x00;
const SECOND_COORDINATE = 0x31;
const DIAGONAL_HEADINGS = 0x341d;
const SECTOR_HEADINGS = 0x3415;
const RUNGS_PER_SECTOR = 32;
const COUNTS_BACKWARDS = 0x20;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 51, attract: 55 };

const EXCLUDED = ["f", "b", "c", "d", "e", "sp", "a_"];
/** Object coordinates at both ends of the range: every sign and magnitude of the difference. */
const OBJECT_ENDS = [0, 255];
const SWEEP_SIZE = OBJECT_ENDS.length * OBJECT_ENDS.length * 256 * 256;
const CROSS_CHECK_POINTS = 600;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

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
  if (entry === null) gate(headingToward);
  return entry;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Masked RAM, then the heading the answer is left in. Clone per point. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.a !== b.regs.a) return { addr: null, a: a.regs.a, b: b.regs.a };
  return null;
}

// ── the exhaustive sweep, on two reused machines ────────────────────────────────────────

let arena = null;
function pair() {
  if (!arena) arena = [entryState().clone(), entryState().clone()];
  return arena;
}

const lowerCell = (point) => (point & 0xff00) | u8(point - 1);

function answerDiffers(candidate, objectFirst, objectSecond, pointFirst, pointSecond) {
  const [a, b] = pair();
  const e = entryState();
  for (const m of [a, b]) {
    m.regs.hl = e.regs.hl;
    m.regs.iy = e.regs.iy;
    m.regs.sp = e.regs.sp;
    m.mem8[e.regs.hl] = pointFirst;
    m.mem8[lowerCell(e.regs.hl)] = pointSecond;
    m.mem8[u16(e.regs.iy + FIRST_COORDINATE)] = objectFirst;
    m.mem8[u16(e.regs.iy + SECOND_COORDINATE)] = objectSecond;
  }
  oracle(a);
  const returned = candidate(b);
  return a.regs.a !== b.regs.a || returned !== a.regs.a;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const objectFirst of OBJECT_ENDS) {
    for (const objectSecond of OBJECT_ENDS) {
      for (let pointFirst = 0; pointFirst < 256; pointFirst++) {
        for (let pointSecond = 0; pointSecond < 256; pointSecond++) {
          if (answerDiffers(candidate, objectFirst, objectSecond, pointFirst, pointSecond)) caught++;
        }
      }
    }
  }
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const points = new Set();
  const answers = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      points.add(mm.regs.hl);
      if (unitDiff(candidate, mm)) caught++;
      const probe = mm.clone();
      oracle(probe);
      answers.add(probe.regs.a);
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, points, answers };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, headingToward) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

function legs(m) {
  const { mem8, regs } = m;
  const first = mem8[regs.hl] - mem8[u16(regs.iy + FIRST_COORDINATE)];
  const second = mem8[lowerCell(regs.hl)] - mem8[u16(regs.iy + SECOND_COORDINATE)];
  return [first, second];
}

function answer(m, { rungs = RUNGS_PER_SECTOR, backwards = true, sectorBits = null, diagonal = true } = {}) {
  const { mem8, regs } = m;
  const [first, second] = legs(m);
  let sector = sectorBits
    ? sectorBits(first, second)
    : (second < 0 ? 0x01 : 0) | (first < 0 ? 0x02 : 0);
  const firstLeg = Math.abs(first);
  const secondLeg = Math.abs(second);
  if (diagonal && firstLeg === secondLeg) {
    regs.a = mem8[DIAGONAL_HEADINGS + sector];
    return regs.a;
  }
  if (firstLeg < secondLeg) sector |= 0x04;
  const shorter = Math.min(firstLeg, secondLeg);
  const longer = Math.max(firstLeg, secondLeg);
  let rung = longer === 0 ? 0 : Math.floor((shorter * rungs) / longer);
  const heading = mem8[SECTOR_HEADINGS + sector];
  if (backwards && heading & COUNTS_BACKWARDS) rung = rungs - 1 - rung;
  regs.a = u8(heading + rung);
  return regs.a;
}

/** BUG: does nothing at all, so the answer is whatever the caller was holding. */
function brokenNoOp() {}

/** BUG: the rung is measured in sixty-fourths, so half a sector is compressed into the other. */
function brokenWrongRungCount(m) {
  return answer(m, { rungs: 64 });
}

/** BUG: every sector counts its rungs forwards, so alternate sectors sweep the wrong way. */
function brokenNeverCountsBackwards(m) {
  return answer(m, { backwards: false });
}

/** BUG: the two sign bits go into each other's place. */
function brokenSwapsTheSignBits(m) {
  return answer(m, {
    sectorBits: (first, second) => (first < 0 ? 0x01 : 0) | (second < 0 ? 0x02 : 0),
  });
}

/** BUG: the equal-legs case falls through to the rung arithmetic instead of the short table. */
function brokenDropsTheDiagonal(m) {
  return answer(m, { diagonal: false });
}

/** BUG: the answer is one heading step out. */
function brokenOffByOne(m) {
  const value = answer(m, {});
  m.regs.a = u8(value + 1);
  return m.regs.a;
}

const TWINS = [
  ["no-op", brokenNoOp, 262144],
  ["wrong-rung-count", brokenWrongRungCount, 257040],
  ["never-counts-backwards", brokenNeverCountsBackwards, 130560],
  ["swaps-the-sign-bits", brokenSwapsTheSignBits, 131070],
  ["drops-the-diagonal", brokenDropsTheDiagonal, 514],
  ["off-by-one", brokenOffByOne, 262144],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the scratch window, answer included", { skip }, () => {
  gate(headingToward);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  const returned = headingToward(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.a, b.regs.a, "the heading left behind diverged");
  assert.equal(returned, a.regs.a, "the returned heading disagrees with the accumulator");
  console.log(
    `  EQUAL: point=${hex4(entryState().regs.hl)} object=${hex4(entryState().regs.iy)} ` +
      `heading=${a.regs.a}`,
  );
});

test("RAM IS BLIND: a candidate one heading out leaves the dump identical", { skip }, () => {
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenOffByOne(b);
  assert.deepEqual(
    allDiffs(a, b).filter((d) => !inScratch(d.addr, sp)),
    [],
    "the off-by-one twin now moves a byte outside the window, so RAM is no longer blind here",
  );
  assert.notEqual(a.regs.a, b.regs.a, "the twin must differ where RAM cannot see");
  console.log("  RAM IS BLIND: the off-by-one twin is dump-identical; only the answer separates");
});

test("CORPUS: every dispatch of two whole sessions replays identically", { skip }, () => {
  let total = 0;
  const points = new Set();
  const answers = new Set();
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    for (const p of s.points) points.add(p);
    for (const v of s.answers) answers.add(v);
    total += s.dispatches;
  }
  assert.ok(answers.size > 1, "vacuous: every real dispatch answered the same heading");
  console.log(
    `  CORPUS: ${total} dispatches over ${points.size} points, ${answers.size} distinct headings`,
  );
});

test("EXCLUDED, deliberately: registers and pc, the alternate accumulator among them", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  headingToward(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("EXHAUSTIVE: every sign and magnitude on both axes gives the same heading", { skip }, () => {
  assert.equal(sweepCaught(headingToward), 0, "the rewrite answered differently somewhere");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} crafted points, heading identical on every one`);
});

test("THE REUSED MACHINES ARE SOUND: clone-per-point agrees on a sample", { skip }, () => {
  const e = entryState();
  let checked = 0;
  for (let i = 0; i < CROSS_CHECK_POINTS; i++) {
    const m = e.clone();
    m.mem8[e.regs.hl] = (i * 61) & 0xff;
    m.mem8[lowerCell(e.regs.hl)] = (i * 37) & 0xff;
    m.mem8[u16(e.regs.iy + FIRST_COORDINATE)] = (i * 13) & 0xff;
    m.mem8[u16(e.regs.iy + SECOND_COORDINATE)] = (i * 7) & 0xff;
    assert.equal(unitDiff(headingToward, m), null, `clone-per-point diverged at sample ${i}`);
    checked++;
  }
  assert.equal(checked, CROSS_CHECK_POINTS, "the cross-check ran short");
  console.log(`  CROSS-CHECK: ${checked} clone-per-point comparisons identical`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted points`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${SWEEP_SIZE} crafted points`);
  });
}
