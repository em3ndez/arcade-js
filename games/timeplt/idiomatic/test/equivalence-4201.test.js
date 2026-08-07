// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerTowardAimOneUnitAFrame — memory-equivalent to the frozen oracle at ROM 0x4201.
 *
 * GATE: strict unit-capture replayed over every dispatch of an undriven attract session, plus an
 *   exhaustive crafted sweep over BOTH bytes the routine reads, plus teeth.
 *
 * WHY THE SESSION IS LONG. Undriven attract does reach this entry, but not early: the first
 *   dispatch lands well past the frame budget the shared gates use, so this file drives 6000
 *   frames of attract rather than poking anything. No cell is forced.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at every real dispatch — the whole state dump is identical, the stack included: the
 *      exclusion window is measured at ZERO bytes and asserted so.
 *   2. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   3. EXCLUDED, deliberately — the register set that may differ is pinned by measurement. The
 *      carry the early return leaves behind is NOT a live-out here and is not asserted; the twin
 *      list says which arms that costs.
 *   4. CORPUS — every dispatch of the session replayed on a clone, not a deduplicated sample.
 *   5. EXHAUSTIVE — all 256 wrapped differences between the two bytes, crafted onto the real entry
 *      state, which is the only arm that reaches both turn directions and both edges of the band.
 *   6. THE SHAPE OF THE ANSWER — the step is read back for every difference and checked to be the
 *      three-valued function the routine is: back one, still, or forward one, with the standing
 *      band exactly two differences wide.
 *   7. TEETH — six twins with exact catch counts over the crafted sweep. Three of them are caught
 *      on ONE or TWO differences out of 256, which is exactly why the counts are asserted: a
 *      sampled sweep would have missed them and reported a clean pass.
 *
 * HOLE: nothing here says what the two bytes ARE beyond one being followed toward the other. That
 * they are headings on a circle is a reading of the wrapped arithmetic, not something this gate
 * establishes.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4201.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { steerTowardAimOneUnitAFrame } from "../steerTowardAimOneUnitAFrame.js";
import { loc_4201 as oracle } from "../../translated/loc_4201.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x4201;
const FRAMES = 6000;
const DISPATCHES = 391;

const AIM_HEADING = 1;
const HEADING = 2;
const HALF_TURN = 128;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["a", "f", "sp"];

const DIFFERENCES = Array.from({ length: 256 }, (_unused, i) => i);
const BASE_HEADING = 0x40;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

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

function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

let entry = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const aways = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    const object = mm.regs.ix;
    aways.add((mm.mem8[object + AIM_HEADING] - mm.mem8[object + HEADING]) & 0xff);
    const sp = mm.regs.sp;
    const b = mm.clone();
    candidate(b);
    const r = oracle(mm);
    if (allDiffs(mm, b).some((d) => !inScratch(d.addr, sp))) caught++;
    return r;
  }]]), { tape: [] });
  const frames = host.runFrames(FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "session ran short");
  return { dispatches, caught, aways };
}

function entryState() {
  if (entry === null) replay(steerTowardAimOneUnitAFrame);
  assert.notEqual(entry, null, "vacuous: the attract session never reached the routine");
  return entry;
}

/** A real captured machine with the two bytes forced to a chosen wrapped difference. */
function craft(away) {
  const m = entryState().clone();
  const object = m.regs.ix;
  m.mem8[object + HEADING] = BASE_HEADING;
  m.mem8[object + AIM_HEADING] = (BASE_HEADING + away) & 0xff;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const away of DIFFERENCES) if (unitDiff(candidate, craft(away))) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

function steer(m, band, step, forwardBelow) {
  const { mem8, regs } = m;
  const object = regs.ix;
  const heading = mem8[object + HEADING];
  const away = (mem8[object + AIM_HEADING] - heading) & 0xff;
  if (((away + 1) & 0xff) < band) return;
  mem8[object + HEADING] = ((away + 1) & 0xff) < forwardBelow ? heading + step : heading - step;
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: no standing band, so it hunts back and forth once it arrives. */
function brokenNoBand(m) {
  steer(m, 0, 1, HALF_TURN);
}

/** BUG: the standing band is one wider than it should be. */
function brokenWideBand(m) {
  steer(m, 3, 1, HALF_TURN);
}

/** BUG: turns two steps at a time. */
function brokenDoubleStep(m) {
  steer(m, 2, 2, HALF_TURN);
}

/** BUG: takes the long way round the circle. */
function brokenWrongWay(m) {
  const { mem8, regs } = m;
  const object = regs.ix;
  const heading = mem8[object + HEADING];
  const away = (mem8[object + AIM_HEADING] - heading) & 0xff;
  if (((away + 1) & 0xff) < 2) return;
  mem8[object + HEADING] = ((away + 1) & 0xff) < HALF_TURN ? heading - 1 : heading + 1;
}

/** BUG: the half-turn split is taken one step off, so one difference turns the wrong way. */
function brokenSplitOffByOne(m) {
  steer(m, 2, 1, HALF_TURN + 1);
}

/** Each twin's exact catch count over the 256 crafted differences. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 254],
  ["no-standing-band", brokenNoBand, 2],
  ["band-one-too-wide", brokenWideBand, 1],
  ["double-step", brokenDoubleStep, 254],
  ["turns-the-long-way", brokenWrongWay, 254],
  ["split-off-by-one", brokenSplitOffByOne, 1],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: steerTowardAimOneUnitAFrame == oracle over the whole dump", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  steerTowardAimOneUnitAFrame(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: sp=${hex4(entryState().regs.sp)}, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(40));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  steerTowardAimOneUnitAFrame(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real attract session replays identically", { skip }, () => {
  const r = replay(steerTowardAimOneUnitAFrame);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  assert.ok(r.aways.size > 1, "vacuous: the session presents one difference only");
  console.log(`  CORPUS: ${r.dispatches} dispatches, ${r.aways.size} distinct differences`);
});

test("EXHAUSTIVE: all 256 wrapped differences behave as the oracle", { skip }, () => {
  assert.equal(sweepCaught(steerTowardAimOneUnitAFrame), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${DIFFERENCES.length} differences identical`);
});

test("THE SHAPE OF THE ANSWER: back one, still, or forward one — and the band is two wide", { skip }, () => {
  const steps = DIFFERENCES.map((away) => {
    const m = craft(away);
    steerTowardAimOneUnitAFrame(m);
    return ((m.mem8[m.regs.ix + HEADING] - BASE_HEADING + 128) & 0xff) - 128;
  });
  assert.deepEqual([...new Set(steps)].sort((x, y) => x - y), [-1, 0, 1], "three outcomes, no more");
  const still = steps.reduce((n, s, away) => (s === 0 ? [...n, away] : n), []);
  assert.deepEqual(still, [0, 255], "the standing band must be the aim and one step behind it");
  assert.equal(steps[1], 1, "one step ahead must turn forward");
  assert.equal(steps[254], -1, "two steps behind must turn back");
  console.log(`  SHAPE: forward ${steps.filter((s) => s === 1).length}, back ` +
    `${steps.filter((s) => s === -1).length}, still ${still.length}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of differences`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${DIFFERENCES.length}`);
  });
}
