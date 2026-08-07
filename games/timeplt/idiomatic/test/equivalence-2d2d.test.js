// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepTwoTileSceneryAtFiveQuarters — memory-equivalent to the frozen oracle at ROM 0x2D2D.
 *
 * GATE: crafted-entry, because the strict one CANNOT run here. The only site that transfers to
 *   0x2D2D is the scenery band's LAST-ERA running order, and neither the shared coin -> start
 *   tape nor an undriven session ever reaches that era, so unitEquivalence throws "never entered"
 *   and the first arm ASSERTS the throw. The entries are not fabricated either: they are captured
 *   at real dispatches of a SIBLING step of the same band, which arrives with the same two cursors
 *   seated on real scenery slots and the same world-scroll cells live. That is a real state with
 *   the routine substituted, rather than a hand-built one.
 *
 *   ONE EXCLUSION, the dead stack scratch: the frozen routine brackets each of its three steps
 *   with a call, so up to four bytes below the entry stack pointer can hold return slots the
 *   rewrite never writes. The window is exactly [SP-4, SP) and every arm PINS it.
 *
 * What it exercises, holes stated:
 *   1. UNREACHED — measured on both sessions, together with the era neither reaches.
 *   2. NOT VACUOUS — an empty candidate FAILS the same masked comparison.
 *   3. CORPUS — every captured sibling entry replayed, so the comparison runs over many real
 *      slots and many real scroll displacements rather than one.
 *   4. EXCLUDED — the register divergence pinned to a measured set.
 *   5. CURSORS — the two cursors are a live-out, compared explicitly, and the arm asserts the
 *      distance they move, which is what makes this a TWO-slot step rather than a one-slot one.
 *   6. TEETH — six twins, each caught on an exact count of the captured entries. The two that
 *      turn on the scroll displacement fall two short of the total, which is the corpus reporting
 *      its own hole rather than a score: on two of the forty captured frames those twins land on
 *      the same bytes as the right answer, and this file does not establish why.
 *
 * HOLE: the scroll displacement is whatever the captured frames carried; it is not swept, so a
 * fraction error that happens to vanish at the displacements this session produced would not be
 * caught here. The wrong-fraction twin's catch count is what says how far that is from vacuous.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2d2d.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stepTwoTileSceneryAtFiveQuarters } from "../stepTwoTileSceneryAtFiveQuarters.js";
import { advanceToNextSlot } from "../advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "../driftAtFiveQuartersWorldScroll.js";
import { driftAtThreeQuartersWorldScroll } from "../driftAtThreeQuartersWorldScroll.js";
import { placeAbuttingTile } from "../placeAbuttingTile.js";
import { ERA_INDEX } from "../names.js";
import { loc_2d2d as oracle } from "../../translated/loc_2d2d.js";
import { loc_2d36 } from "../../translated/loc_2d36.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2d2d;
/** A sibling step of the same band, dispatched constantly, with the same two cursors seated. */
const SIBLING = 0x2d36;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const SCRATCH_BYTES = 4;
const LAST_ERA = 4;
const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;
/** Two slots on: one for the tile laid flush, one for the further step this entry adds. */
const SLOTS_STEPPED = 2;

const CORPUS_FRAMES = 1200;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
const CAPTURES = 40;
const EXCLUDED = ["a", "b", "c", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the captured entries ────────────────────────────────────────────────────────────────

let strictThrew = null;
function strictAttempt() {
  if (strictThrew === null) {
    try {
      unitEquivalence(makeMachine, TARGET, oracle, stepTwoTileSceneryAtFiveQuarters, { maxFrames: ENTRY_FRAMES });
      strictThrew = false;
    } catch (e) {
      strictThrew = e;
    }
  }
  return strictThrew;
}

let captured = null;
function entries() {
  if (captured) return captured;
  captured = [];
  const m = makeMachine(
    new Map([[SIBLING, (mm) => {
      if (captured.length < CAPTURES) captured.push(mm.clone());
      return loc_2d36(mm);
    }]]),
    {},
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `capture session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "capture session ran short");
  return captured;
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

/** Masked RAM, then the two cursors the step leaves standing. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.ix !== b.regs.ix) return { addr: null, a: a.regs.ix, b: b.regs.ix };
  if (a.regs.iy !== b.regs.iy) return { addr: null, a: a.regs.iy, b: b.regs.iy };
  return null;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const m of entries()) if (unitDiff(candidate, m)) caught++;
  return caught;
}

function dispatchCount(opts) {
  let dispatches = 0;
  const eras = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => (dispatches++, eras.add(mm.mem8[ERA_INDEX]), oracle(mm))]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, era: m.mem8[ERA_INDEX] };
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the object drifts and nothing else happens. */
function brokenDriftsOnly(m) {
  driftAtFiveQuartersWorldScroll(m);
}

/** BUG: no second tile is laid, so the object is one tile wide. */
function brokenLaysNoSecondTile(m) {
  driftAtFiveQuartersWorldScroll(m);
  advanceToNextSlot(m);
  advanceToNextSlot(m);
}

/** BUG: the cursors are stepped once, so the next step lands on this object's second half. */
function brokenStepsOnce(m) {
  driftAtFiveQuartersWorldScroll(m);
  placeAbuttingTile(m);
}

/** BUG: the object drifts at the neighbouring rate. */
function brokenWrongFraction(m) {
  driftAtThreeQuartersWorldScroll(m);
  placeAbuttingTile(m);
  advanceToNextSlot(m);
}

/** BUG: the second tile is laid before the drift, so it abuts the object's old position. */
function brokenLaysBeforeDrifting(m) {
  placeAbuttingTile(m);
  driftAtFiveQuartersWorldScroll(m);
  advanceToNextSlot(m);
}

const TWINS = [
  ["no-op", brokenNoOp, 40],
  ["drifts-only", brokenDriftsOnly, 40],
  ["lays-no-second-tile", brokenLaysNoSecondTile, 40],
  ["steps-once", brokenStepsOnce, 40],
  ["wrong-fraction", brokenWrongFraction, 38],
  ["lays-before-drifting", brokenLaysBeforeDrifting, 38],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: the last era's order is never run, so the strict gate cannot", { skip }, () => {
  assert.notEqual(strictAttempt(), false, "the shared tape now reaches this routine, so the " +
    "strict unit-capture gate is available and this file should use it");
  assert.match(String(strictAttempt()), /never entered/, "the harness failed for another reason");
  for (const [label, opts] of TAPES) {
    const r = dispatchCount(opts);
    assert.equal(r.dispatches, 0, `the ${label} session now dispatches this routine`);
    assert.notEqual(r.era, LAST_ERA, `the ${label} session now reaches the last era`);
  }
  console.log(
    `  UNREACHED: 0 dispatches over ${TAPES.length} sessions of ${CORPUS_FRAMES} frames; the ` +
      `entries below are ${entries().length} real dispatches of a sibling step of the same band`,
  );
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same masked comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entries()[0]);
  assert.notEqual(d, null, "the masked diff passed an empty candidate, so it measures nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CORPUS: every captured sibling entry replays identically", { skip }, () => {
  assert.equal(entries().length, CAPTURES, "the capture session produced a different number");
  assert.equal(sweepCaught(stepTwoTileSceneryAtFiveQuarters), 0, "the rewrite diverged on a captured entry");
  const slots = new Set(entries().map((m) => m.regs.iy));
  assert.ok(slots.size > 1, "vacuous: every captured entry is seated on the same slot");
  console.log(`  CORPUS: ${entries().length} captured entries over ${slots.size} slots, identical`);
});

test("EXCLUDED, deliberately: registers and pc, and the scratch pushes", { skip }, () => {
  const a = entries()[0].clone();
  const b = a.clone();
  oracle(a);
  stepTwoTileSceneryAtFiveQuarters(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape: the two cursors are live-outs and must not appear here",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("CURSORS: both step two slots on, which is what makes this a two-tile step", { skip }, () => {
  const before = entries()[0];
  const after = before.clone();
  stepTwoTileSceneryAtFiveQuarters(after);
  assert.equal(after.regs.ix - before.regs.ix, SLOTS_STEPPED * RECORD_STRIDE, "the record cursor " +
    "did not step two slots");
  assert.equal(after.regs.iy - before.regs.iy, SLOTS_STEPPED * ENTRY_STRIDE, "the sprite-entry " +
    "cursor did not step two slots");
  console.log(
    `  CURSORS: ${hex4(before.regs.ix)} -> ${hex4(after.regs.ix)} and ` +
      `${hex4(before.regs.iy)} -> ${hex4(after.regs.iy)}, two slots each`,
  );
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of captured entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${entries().length} captured entries`);
  });
}
