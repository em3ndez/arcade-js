// SPDX-License-Identifier: GPL-3.0-only
/**
 * driftThreeTileSceneryAtFiveQuarters — memory-equivalent to the frozen oracle at ROM 0x2D15.
 *
 * GATE: strict unit-capture with ONE exclusion, a corpus replay of every dispatch of a driven
 *   session, and a crafted sweep over the shared displacement and the object's own coordinates.
 *   What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — everything outside a four-byte dead scratch window below the
 *      entry stack pointer. The window is where the frozen chain parks resume addresses that the
 *      stack-free rewrite never lays down; it is an upper bound, and every arm PINS it, so it
 *      cannot quietly widen into real memory.
 *   2. NOT VACUOUS — a candidate that does nothing is caught at the same dispatch, on a real cell.
 *   3. THE STEPPED CURSORS ARE A LIVE-OUT, compared explicitly: the caller walks straight on into
 *      the next object from where this entry leaves them, so a rewrite that moved the right bytes
 *      and left the cursors wrong would pass a memory-only comparison.
 *   4. CROSS — the shared displacement against a spread of whole and fractional coordinates, all
 *      poked identically on both sides. This is the arm that covers the carries and the wraps.
 *   5. CORPUS — every dispatch of a driven session, on a clone taken at the dispatch.
 *   6. TEETH — seven twins: the three steps missing, doubled, mis-rated and reordered, each
 *      caught on its own exact count over the cross.
 *
 * HOLE: this gate fixes the SHAPE of the object — one drift plus two abutting tiles plus one step
 * — and the rates belong to the steps, whose own gates cover them. Nothing here says what the
 * object is or why it is three tiles wide.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2d15.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { driftThreeTileSceneryAtFiveQuarters } from "../driftThreeTileSceneryAtFiveQuarters.js";
import { loc_2d15 as oracle } from "../../translated/loc_2d15.js";
import { advanceToNextSlot } from "../advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "../driftAtFiveQuartersWorldScroll.js";
import { driftAtThreeQuartersWorldScroll } from "../driftAtThreeQuartersWorldScroll.js";
import { placeAbuttingTile } from "../placeAbuttingTile.js";
import { u16 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";

const TARGET = 0x2d15;

const WHOLE_SECOND_AXIS = 49;
const FRACTION_FIRST = 3;
const FRACTION_SECOND = 5;

/**
 * The dead stack scratch: the frozen chain parks a resume address before each of its calls, and
 * the stack-free rewrite parks nothing. Measured as an upper bound over every arm below.
 */
const SCRATCH_BYTES = 4;

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 788;

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function outsideScratch(a, b, sp) {
  return allDiffs(a, b).filter((d) => d.addr < sp - SCRATCH_BYTES || d.addr >= sp);
}

/** Oracle vs candidate on two clones: masked memory first, then the two stepped cursors. */
function compare(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = outsideScratch(a, b, sp)[0];
  if (ram) return ram;
  if (a.regs.ix !== b.regs.ix) return { addr: null, a: a.regs.ix, b: b.regs.ix };
  if (a.regs.iy !== b.regs.iy) return { addr: null, a: a.regs.iy, b: b.regs.iy };
  return null;
}

let captured = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  return { dispatches, caught };
}

function entryState() {
  if (captured === null) replay(driftThreeTileSceneryAtFiveQuarters);
  return captured;
}

function craft(shared, whole, fraction) {
  const m = entryState().clone();
  m.mem16[WORLD_SCROLL_Y] = u16(shared);
  m.mem16[WORLD_SCROLL_X] = u16(shared ^ 0x5a5a);
  m.mem8[m.regs.iy + WHOLE_SECOND_AXIS] = whole;
  m.mem8[m.regs.iy] = 255 - whole;
  m.mem8[m.regs.ix + FRACTION_FIRST] = fraction;
  m.mem8[m.regs.ix + FRACTION_SECOND] = 255 - fraction;
  return m;
}

const SHARED_VALUES = [0, 1, 0x0100, 0x00ff, 0xff00, 0xffff, 0x8000, 0x7fff];
const WHOLES = [0, 1, 127, 128, 254, 255];
const FRACTIONS = [0, 1, 127, 128, 255];
const CROSS_SIZE = SHARED_VALUES.length * WHOLES.length * FRACTIONS.length;

function eachCrossEntry(body) {
  for (const shared of SHARED_VALUES) {
    for (const whole of WHOLES) {
      for (const fraction of FRACTIONS) body(shared, whole, fraction);
    }
  }
}

function crossCaught(candidate) {
  let caught = 0;
  eachCrossEntry((shared, whole, fraction) => {
    if (compare(candidate, craft(shared, whole, fraction))) caught++;
  });
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the scratch window", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  driftThreeTileSceneryAtFiveQuarters(b);
  assert.deepEqual(
    outsideScratch(a, b, sp),
    [],
    `a divergence escaped the scratch window — ${show(outsideScratch(a, b, sp)[0])}`,
  );
  assert.ok(
    allDiffs(a, b).length > 0,
    "nothing differs at all, so the scratch exclusion is buying nothing and should be dropped",
  );
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    ["a", "f", "b", "c", "e", "sp"],
    "the excluded set changed shape: the two cursors are live-outs and must NOT be in here",
  );
  console.log(
    `  EQUAL: record ${hex4(entry.regs.ix)}, entry ${hex4(entry.regs.iy)}, sp ${hex4(sp)}`,
  );
});

test("NOT VACUOUS: a candidate that does nothing is caught on a real cell", { skip }, () => {
  const d = compare(() => {}, entryState());
  assert.notEqual(d, null, "the masked diff passed a no-op, so memory is NOT the gate here");
  assert.notEqual(d.addr, null, "the no-op must be caught in memory, not on the cursors alone");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("THE STEPPED CURSORS: both land where the frozen chain leaves them", { skip }, () => {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  driftThreeTileSceneryAtFiveQuarters(b);
  assert.equal(b.regs.ix, a.regs.ix, "the record cursor diverged");
  assert.equal(b.regs.iy, a.regs.iy, "the entry cursor diverged");
  assert.equal(a.regs.ix - entry.regs.ix, 48, "the record cursor no longer steps three records");
  assert.equal(a.regs.iy - entry.regs.iy, 6, "the entry cursor no longer steps three entries");
  console.log(
    `  CURSORS: record ${hex4(entry.regs.ix)}->${hex4(a.regs.ix)}, ` +
      `entry ${hex4(entry.regs.iy)}->${hex4(a.regs.iy)}`,
  );
});

test("CROSS: displacement x whole x fraction all behave alike", { skip }, () => {
  eachCrossEntry((shared, whole, fraction) => {
    const d = compare(driftThreeTileSceneryAtFiveQuarters, craft(shared, whole, fraction));
    assert.equal(d, null, `shared=${shared} whole=${whole} fraction=${fraction}: ${show(d)}`);
  });
  console.log(`  CROSS: ${CROSS_SIZE} combinations identical`);
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(driftThreeTileSceneryAtFiveQuarters);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  console.log(`  CORPUS: ${r.dispatches} dispatches identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
const brokenNoOp = () => {};

/** BUG: only one abutting tile is laid, so the object is two tiles wide. */
function brokenOneTileShort(m) {
  driftAtFiveQuartersWorldScroll(m);
  placeAbuttingTile(m);
  advanceToNextSlot(m);
}

/** BUG: three abutting tiles are laid, so the object runs into the next slot. */
function brokenOneTileLong(m) {
  driftAtFiveQuartersWorldScroll(m);
  placeAbuttingTile(m);
  placeAbuttingTile(m);
  placeAbuttingTile(m);
  advanceToNextSlot(m);
}

/** BUG: the slot is drifted at the wrong rate. */
function brokenWrongDriftRate(m) {
  driftAtThreeQuartersWorldScroll(m);
  placeAbuttingTile(m);
  placeAbuttingTile(m);
  advanceToNextSlot(m);
}

/** BUG: the tiles are laid before the drift, so they carry last frame's position. */
function brokenTilesBeforeDrift(m) {
  placeAbuttingTile(m);
  placeAbuttingTile(m);
  driftAtFiveQuartersWorldScroll(m);
  advanceToNextSlot(m);
}

/** BUG: the final step is missing, so the caller walks the same slot again. */
function brokenNoFinalStep(m) {
  driftAtFiveQuartersWorldScroll(m);
  placeAbuttingTile(m);
  placeAbuttingTile(m);
}

/** BUG: the drift is dropped, so the object stands still in a moving world. */
function brokenNoDrift(m) {
  placeAbuttingTile(m);
  placeAbuttingTile(m);
  advanceToNextSlot(m);
}

const TWINS = [
  ["no-op", brokenNoOp, 240],
  ["one-tile-short", brokenOneTileShort, 240],
  ["one-tile-long", brokenOneTileLong, 240],
  ["wrong-drift-rate", brokenWrongDriftRate, 240],
  ["tiles-before-drift", brokenTilesBeforeDrift, 240],
  ["no-final-step", brokenNoFinalStep, 240],
  ["no-drift", brokenNoDrift, 240],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the cross`, { skip }, () => {
    assert.equal(crossCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${CROSS_SIZE} cross entries`);
  });
}
