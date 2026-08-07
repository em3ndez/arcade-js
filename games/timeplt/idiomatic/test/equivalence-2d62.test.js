// SPDX-License-Identifier: GPL-3.0-only
/**
 * driftOneTileSceneryAtThreeQuarters — memory-equivalent to the frozen oracle at ROM 0x2D62.
 *
 * ★ NO TAPE REACHES IT, AND THAT IS ASSERTED, NOT ASSUMED. Three sessions — the shared coin-then-
 *   start tape, an undriven attract run, and a long driven one that fires and steers — dispatch
 *   this address zero times between them. So the entry state is CRAFTED: a machine captured at a
 *   real dispatch of the sibling entry that walks the SAME slot band with the same pair of
 *   cursors, and then the cells this entry reads are forced. A real state with a surgical nudge.
 *
 * GATE, holes stated:
 *   1. NO TAPE REACHES IT, and the sibling that supplies the base does — both reported.
 *   2. CROSS — the shared displacement against a spread of whole and fractional coordinates, poked
 *      identically on both sides, compared outside a four-byte dead scratch window below the entry
 *      stack pointer where the frozen chain parks resume addresses. Pinned by every arm.
 *   3. NOT VACUOUS — a candidate that does nothing is caught, on a real cell.
 *   4. THE STEPPED CURSORS ARE A LIVE-OUT, compared explicitly, because the caller walks straight
 *      on into the next slot from where this entry leaves them.
 *   5. IT IS ONE TILE, measured: the frozen entry's write set is four bytes of ONE slot, so the
 *      claim that nothing abutting is laid is checked rather than asserted.
 *   6. TEETH — six twins, each caught on its own exact count over the cross.
 *
 * HOLE: the drift RATE belongs to the step this entry hands to, and its own gate covers it. What
 * this file fixes is that ONE slot is drifted and the cursors then step once.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2d62.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { driftOneTileSceneryAtThreeQuarters } from "../driftOneTileSceneryAtThreeQuarters.js";
import { loc_2d62 as oracle } from "../../translated/loc_2d62.js";
import { advanceToNextSlot } from "../advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "../driftAtFiveQuartersWorldScroll.js";
import { driftAtHalfWorldScroll } from "../driftAtHalfWorldScroll.js";
import { driftAtThreeQuartersWorldScroll } from "../driftAtThreeQuartersWorldScroll.js";
import { placeAbuttingTile } from "../placeAbuttingTile.js";
import { buildRoutines } from "../../routines.js";
import { u16 } from "../../../../core/int.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";

const TARGET = 0x2d62;

/** The sibling that walks the same slot band, which the shared tape does dispatch. */
const BASE_DISPATCH = 0x2d15;

const WHOLE_SECOND_AXIS = 49;
const FRACTION_FIRST = 3;
const FRACTION_SECOND = 5;
const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

const SCRATCH_BYTES = 4;

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

const oracles = buildRoutines();
const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;

function drivenTape(frames) {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
    { frame: 632, port: IN1, bits: 0x10, dur: frames },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
  let frame = 640;
  for (let step = 0; step < 40; step++) {
    tape.push({ frame, port: IN1, bits: compass[step % compass.length], dur: 60 });
    frame += 60;
  }
  return tape;
}

const SESSIONS = [
  ["shared", {}, ENTRY_FRAMES],
  ["attract", { tape: [] }, 3000],
  ["driven", { tape: drivenTape(4000) }, 4000],
];

function dispatchesOf(address) {
  return SESSIONS.map(([label, opts, frames]) => {
    let hits = 0;
    const m = makeMachine(
      new Map([[address, (mm, ...args) => (hits++, oracles.get(address)(mm, ...args))]]),
      opts,
    );
    m.runFrames(frames);
    assert.equal(m.stoppedBy, null, `the ${label} session stopped early: ${m.stoppedBy}`);
    return [label, hits];
  });
}

let base = null;

function baseState() {
  if (base !== null) return base;
  const m = makeMachine(
    new Map([[BASE_DISPATCH, (mm, ...args) => {
      if (base === null) base = mm.clone();
      return oracles.get(BASE_DISPATCH)(mm, ...args);
    }]]),
  );
  m.runFrames(ENTRY_FRAMES);
  assert.notEqual(base, null, "the sibling was never dispatched either");
  return base;
}

function craft(shared, whole, fraction) {
  const m = baseState().clone();
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

test("NO TAPE REACHES IT: three sessions dispatch it zero times", { skip }, () => {
  const counts = dispatchesOf(TARGET);
  for (const [label, hits] of counts) {
    assert.equal(hits, 0, `the ${label} session now reaches it, so this gate should capture there`);
  }
  const siblingCounts = dispatchesOf(BASE_DISPATCH);
  assert.ok(
    siblingCounts.some(([, hits]) => hits > 0),
    "the sibling is no longer dispatched either, so the crafted entry has no real machine",
  );
  console.log(
    `  NO TAPE: ${counts.map(([l, h]) => `${l} ${h}`).join(", ")}; sibling ` +
      `${siblingCounts.map(([l, h]) => `${l} ${h}`).join(", ")}`,
  );
});

test("CROSS: displacement x whole x fraction all behave alike", { skip }, () => {
  eachCrossEntry((shared, whole, fraction) => {
    const d = compare(driftOneTileSceneryAtThreeQuarters, craft(shared, whole, fraction));
    assert.equal(d, null, `shared=${shared} whole=${whole} fraction=${fraction}: ${show(d)}`);
  });
  console.log(`  CROSS: ${CROSS_SIZE} combinations identical`);
});

test("NOT VACUOUS: a candidate that does nothing is caught on a real cell", { skip }, () => {
  const d = compare(() => {}, craft(0x0180, 100, 0));
  assert.notEqual(d, null, "the masked diff passed a no-op, so memory is NOT the gate here");
  assert.notEqual(d.addr, null, "the no-op must be caught in memory, not on the cursors alone");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("THE STEPPED CURSORS: both step exactly one slot", { skip }, () => {
  const before = craft(0x0180, 100, 0);
  const a = before.clone();
  const b = before.clone();
  oracle(a);
  driftOneTileSceneryAtThreeQuarters(b);
  assert.equal(b.regs.ix, a.regs.ix, "the record cursor diverged");
  assert.equal(b.regs.iy, a.regs.iy, "the entry cursor diverged");
  assert.equal(a.regs.ix - before.regs.ix, RECORD_STRIDE, "the record cursor no longer steps once");
  assert.equal(a.regs.iy - before.regs.iy, ENTRY_STRIDE, "the entry cursor no longer steps once");
  console.log(
    `  CURSORS: record ${hex4(before.regs.ix)}->${hex4(a.regs.ix)}, ` +
      `entry ${hex4(before.regs.iy)}->${hex4(a.regs.iy)}`,
  );
});

test("IT IS ONE TILE: the write set is four bytes of one slot", { skip }, () => {
  const before = craft(0x0180, 100, 0);
  const record = before.regs.ix;
  const entry = before.regs.iy;
  const expected = [record + FRACTION_FIRST, record + FRACTION_SECOND, entry,
    entry + WHOLE_SECOND_AXIS].sort((x, y) => x - y);
  const seen = new Set();
  eachCrossEntry((shared, whole, fraction) => {
    const was = craft(shared, whole, fraction);
    const now = was.clone();
    oracle(now);
    for (const d of outsideScratch(was, now, was.regs.sp)) seen.add(d.addr);
  });
  const strays = [...seen].filter((addr) => !expected.includes(addr));
  assert.deepEqual(strays.map(hex4), [], "it wrote outside the one slot's four bytes");
  assert.ok(seen.size > 1, "vacuous: the cross moved at most one byte");
  console.log(`  ONE TILE: ${seen.size} of ${expected.length} bytes ever moved, none outside`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

const TWINS = [
  ["no-op", () => {}, 240],
  ["wrong-drift-rate", (m) => {
    driftAtHalfWorldScroll(m);
    advanceToNextSlot(m);
  }, 240],
  ["faster-drift-rate", (m) => {
    driftAtFiveQuartersWorldScroll(m);
    advanceToNextSlot(m);
  }, 240],
  ["lays-a-tile", (m) => {
    driftAtThreeQuartersWorldScroll(m);
    placeAbuttingTile(m);
    advanceToNextSlot(m);
  }, 240],
  ["no-step", (m) => driftAtThreeQuartersWorldScroll(m), 240],
  ["no-drift", (m) => advanceToNextSlot(m), 240],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the cross`, { skip }, () => {
    assert.equal(crossCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${CROSS_SIZE} cross entries`);
  });
}
