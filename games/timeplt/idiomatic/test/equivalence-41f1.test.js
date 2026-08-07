// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFixedShapeCycleAtHalfRate — memory-equivalent to the frozen oracle at ROM 0x41F1.
 *
 * GATE: poked-natural dispatch with a negative control, replayed over every dispatch of the
 *   session, plus an exhaustive crafted sweep over the counter cell, plus teeth.
 *
 * WHY A POKE IS NEEDED, AND WHAT IT IS. The arm that reaches this entry is taken only while the
 *   era index reads four, and neither the shared coin -> start tape nor undriven attract gets that
 *   far inside the frame budget. One cell is held at four from frame 260; the game then dispatches
 *   this entry itself, hundreds of times, with everything else running normally.
 *
 * What it exercises, with the holes stated:
 *   1. NEGATIVE CONTROL — the identical run without the poke dispatches it ZERO times. Asserted,
 *      so the poke is shown to be what reaches the arm rather than assumed to be.
 *   2. EQUAL at the poked dispatch — the whole state dump is identical, the stack included: the
 *      exclusion window is measured at ZERO bytes and asserted so.
 *   3. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   4. EXCLUDED, deliberately — the register set that may differ is pinned by measurement.
 *   5. CORPUS — every dispatch of the poked session replayed on a clone.
 *   6. EXHAUSTIVE — all 256 counter values crafted onto a real entry state, and the run of shapes
 *      it produces is checked to be exactly eight consecutive codes, each held for two counts.
 *   7. TEETH — six twins with exact catch counts over the crafted sweep.
 *
 * HOLE: the poke pins the era, so everything here is the era-four arm. Nothing says whether the
 * entry is dispatched at all in another era, only that this run did not reach it.
 * HOLE: nothing here identifies the object the sprite entry belongs to, nor what the eight shapes
 * look like. The gate fixes the run, its stride and the constant beside it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-41f1.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { animateFixedShapeCycleAtHalfRate } from "../animateFixedShapeCycleAtHalfRate.js";
import { loc_41f1 as oracle } from "../../translated/loc_41f1.js";
import { ERA_INDEX, FRAME_TICK } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x41f1;
const FRAMES = 1600;
const DISPATCHES = 564;
const ERA_THAT_DISPATCHES = 4;
const POKE_FROM_FRAME = 260;

const SHAPE = 1;
const ATTRIBUTE = 0x30;
const FIRST_SHAPE = 80;
const SHAPES = 8;
const COUNTS_PER_SHAPE = 2;
const TINT = 10;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["a", "f", "sp"];

const COUNTERS = Array.from({ length: 256 }, (_unused, i) => i);

const IN0 = 0xc300;
const IN1 = 0xc320;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** A driven session: coin, start, the trigger held, and the stick walked round the compass. */
function playTape() {
  const tape = [
    { frame: 401, port: IN0, bits: 0x01, dur: 8 },
    { frame: 501, port: IN0, bits: 0x08, dur: 8 },
    { frame: 600, port: IN1, bits: 0x10, dur: FRAMES },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09];
  let frame = 640;
  while (frame < FRAMES) {
    for (const bits of compass) {
      tape.push({ frame, port: IN1, bits, dur: 40 });
      frame += 40;
    }
  }
  return tape;
}

function makePoked(overrides, poked) {
  const m = makeMachine(overrides, { tape: playTape() });
  if (poked) {
    m.pokes = [{ addr: ERA_INDEX, val: ERA_THAT_DISPATCHES, frame: POKE_FROM_FRAME, dur: null }];
  }
  return m;
}

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

function replay(candidate, poked = true) {
  let dispatches = 0;
  let caught = 0;
  const counters = new Set();
  const host = makePoked(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null && poked) entry = mm.clone();
    counters.add(mm.mem8[FRAME_TICK]);
    const sp = mm.regs.sp;
    const b = mm.clone();
    candidate(b);
    const r = oracle(mm);
    if (allDiffs(mm, b).some((d) => !inScratch(d.addr, sp))) caught++;
    return r;
  }]]), poked);
  const frames = host.runFrames(FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "session ran short");
  return { dispatches, caught, counters };
}

function entryState() {
  if (entry === null) replay(animateFixedShapeCycleAtHalfRate);
  assert.notEqual(entry, null, "vacuous: the poked session never reached the routine");
  return entry;
}

/** A real captured machine with the counter cell forced. */
function craft(counter) {
  const m = entryState().clone();
  m.mem8[FRAME_TICK] = counter;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const c of COUNTERS) if (unitDiff(candidate, craft(c))) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

function animate(m, countsPerShape, shapes, firstShape, tint, both) {
  const { mem8, regs } = m;
  const sprite = regs.iy;
  const step = Math.floor(mem8[FRAME_TICK] / countsPerShape) % shapes;
  mem8[sprite + SHAPE] = (firstShape + step) & 0xff;
  if (both) mem8[sprite + ATTRIBUTE] = tint;
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: steps a shape per count, so the run cycles twice as fast. */
function brokenStepPerCount(m) {
  animate(m, 1, SHAPES, FIRST_SHAPE, TINT, true);
}

/** BUG: sixteen shapes instead of eight, so it walks off the end of the run. */
function brokenSixteenShapes(m) {
  animate(m, COUNTS_PER_SHAPE, 16, FIRST_SHAPE, TINT, true);
}

/** BUG: the run starts one shape early. */
function brokenFirstShape(m) {
  animate(m, COUNTS_PER_SHAPE, SHAPES, FIRST_SHAPE - 1, TINT, true);
}

/** BUG: the tint is one out. */
function brokenTint(m) {
  animate(m, COUNTS_PER_SHAPE, SHAPES, FIRST_SHAPE, TINT + 1, true);
}

/** BUG: writes the shape and leaves the tint standing. */
function brokenShapeOnly(m) {
  animate(m, COUNTS_PER_SHAPE, SHAPES, FIRST_SHAPE, TINT, false);
}

/** Each twin's exact catch count over the 256 crafted counters. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["step-per-count", brokenStepPerCount, 224],
  ["sixteen-shapes", brokenSixteenShapes, 128],
  ["first-shape-off-by-one", brokenFirstShape, 256],
  ["tint-off-by-one", brokenTint, 256],
  ["shape-only", brokenShapeOnly, 256],
];

// ── the control ─────────────────────────────────────────────────────────────────────────

test("NEGATIVE CONTROL: with the era left alone the session never dispatches it", { skip }, () => {
  const r = replay(animateFixedShapeCycleAtHalfRate, false);
  assert.equal(r.dispatches, 0, "the unpoked session reached the arm, so the poke proves nothing");
  console.log("  CONTROL: zero dispatches with the era left alone");
});

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the poked dispatch: animateFixedShapeCycleAtHalfRate == oracle over the whole dump", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  animateFixedShapeCycleAtHalfRate(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: sp=${hex4(entryState().regs.sp)}, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(0x11));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  animateFixedShapeCycleAtHalfRate(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of the poked session replays identically", { skip }, () => {
  const r = replay(animateFixedShapeCycleAtHalfRate);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  assert.ok(r.counters.size > 1, "vacuous: the session presents one counter value only");
  console.log(`  CORPUS: ${r.dispatches} dispatches, ${r.counters.size} distinct counter values`);
});

test("EXHAUSTIVE: all 256 counters, and the run is eight shapes held two counts each", { skip }, () => {
  assert.equal(sweepCaught(animateFixedShapeCycleAtHalfRate), 0, "the rewrite diverged somewhere in the crafted space");
  const byCounter = COUNTERS.map((c) => {
    const m = craft(c);
    animateFixedShapeCycleAtHalfRate(m);
    return m.mem8[m.regs.iy + SHAPE];
  });
  const distinct = new Set(byCounter);
  assert.equal(distinct.size, SHAPES, "the run must be exactly eight distinct shapes");
  assert.deepEqual(
    [...distinct].sort((x, y) => x - y),
    Array.from({ length: SHAPES }, (_unused, i) => FIRST_SHAPE + i),
    "the eight shapes must be consecutive from the first",
  );
  for (let c = 0; c < 256; c += COUNTS_PER_SHAPE) {
    assert.equal(byCounter[c], byCounter[c + 1], `counters ${c} and ${c + 1} must share a shape`);
  }
  console.log(`  EXHAUSTIVE: ${COUNTERS.length} counters, ${distinct.size} shapes, held in pairs`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of counters`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${COUNTERS.length} counters`);
  });
}
