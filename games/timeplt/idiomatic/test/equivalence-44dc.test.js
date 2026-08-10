// SPDX-License-Identifier: GPL-3.0-only
/**
 * dressSpriteFlutterShapesByFrameTickBit — memory-equivalent to the frozen oracle at ROM 0x44DC.
 *
 * WHAT IT IS. Two stores: a pair of shape codes into two slots of one sprite entry, the pair
 * chosen by one bit of a counter cell. It reads that cell and nothing else.
 *
 * ★ NO TAPE REACHES THIS ENTRY AT ALL, and the UNREACHED arm asserts it: the shared tape, undriven
 *   attract and a driven turning tape each dispatch it ZERO times in the corpus budget. So there is
 *   no captured entry of its own, and the corpus here is REAL MACHINE STATES sampled at the
 *   dispatches of the routine it falls out of — the same machine, one routine earlier, with a real
 *   sprite entry and a real counter. Every arm below is a crafted entry in that sense.
 *
 * GATE: crafted entries on real machine states, exhaustive in the one cell the entry reads. What it
 *   exercises, holes stated:
 *
 *   1. UNREACHED — three tapes, zero dispatches each, asserted.
 *   2. EQUAL on real states — RAM byte-identical with nothing masked, at every sampled state.
 *   3. NOT VACUOUS — a candidate that does nothing FAILS the same comparison.
 *   4. EXCLUDED, DELIBERATELY — the union of every register that differs anywhere in the crafted
 *      space, asserted inside the allowed set: diverging outside it fails, diverging on fewer passes.
 *   5. EXHAUSTIVE — all 256 counter values, which is the entry's whole input space, on three
 *      sprite-entry bases: the real one and two chosen.
 *   6. BOTH ARMS — the sweep is asserted to present both states of the deciding bit.
 *   7. TEETH — six twins, each with an exact catch count.
 *
 * HOLE: there is no whole-machine arm — no session dispatches this entry, so wiring the rewrite over
 * the address would pass vacuously. Nothing here speaks for the registers the entry leaves behind
 * beyond the crafted comparison, which is why arm 4 bounds the whole space rather than calling them dead.
 * HOLE: the sampled states all come from one routine's dispatches in one session, so the sprite
 * entry base is nearly constant across them; the two chosen bases stand in for that.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-44dc.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { dressSpriteFlutterShapesByFrameTickBit } from "../dressSpriteFlutterShapesByFrameTickBit.js";
import { loc_44dc as oracle } from "../../translated/loc_44dc.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";
import { FRAME_TICK } from "../names.js";

const TARGET = 0x44dc;
/** The routine this entry falls out of; its dispatches are where the real states come from. */
const SAMPLED_AT = 0x4447;

const ALTERNATION_BIT = 0x04;
const FIRST_SHAPE = 0xd5;
const SECOND_SHAPE = 0xd4;
const SHAPE_STEP = 2;
const FIRST_SLOT = 1;
const SECOND_SLOT = 3;

const EXCLUDED = ["a", "f", "d", "e", "h", "l", "sp"];
const CORPUS_FRAMES = 4000;
const SAMPLES = 205;
const ATTRACT = { tape: [] };

const skip = romsPresent() ? false : "ROM images are not assembled";
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

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b)[0] ?? null;
}

/** Real machine states, sampled where this entry's own body is about to be reached. */
let samples = null;
function realStates() {
  if (samples === null) {
    samples = [];
    const base = buildRoutines();
    const orig = base.get(SAMPLED_AT);
    const m = makeMachine(new Map([[SAMPLED_AT, (mm, ...args) => {
      samples.push(mm.clone());
      return orig(mm, ...args);
    }]]), ATTRACT);
    m.runFrames(CORPUS_FRAMES);
  }
  assert.ok(samples.length > 0, "vacuous: the session never reached the sampling point");
  return samples;
}

/** A sampled real state with the counter and the sprite-entry base forced. */
function craft(counter, base) {
  const m = realStates()[0].clone();
  m.mem8[FRAME_TICK] = counter;
  if (base !== null) m.regs.iy = base;
  return m;
}

const COUNTERS = Array.from({ length: 256 }, (_unused, c) => c);
const BASES = [null, 0xa900, 0xaa42];
const SWEEP_SIZE = COUNTERS.length * BASES.length;

function overSweep(fn) {
  for (const base of BASES) for (const counter of COUNTERS) fn(craft(counter, base));
}

function sweepCaught(candidate) {
  let caught = 0;
  overSweep((machine) => {
    if (unitDiff(candidate, machine)) caught++;
  });
  return caught;
}

function movedRegisters(candidate) {
  const moved = new Set();
  overSweep((machine) => {
    const a = machine.clone();
    const b = machine.clone();
    oracle(a);
    candidate(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  });
  return REG_FIELDS.filter((k) => moved.has(k));
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

const slot = (m, n) => (m.regs.iy + n) & 0xffff;
const put = (m, first, second) => {
  m.mem8[slot(m, FIRST_SLOT)] = first;
  m.mem8[slot(m, SECOND_SLOT)] = second;
};

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the deciding bit is the wrong one, so the flutter runs at a different rate. */
function brokenWrongBit(m) {
  const flutter = (m.mem8[FRAME_TICK] & 0x08) === 0 ? SHAPE_STEP : 0;
  put(m, FIRST_SHAPE + flutter, SECOND_SHAPE + flutter);
}

/** BUG: the sense of the test is inverted, so the two frames of the flutter swap. */
function brokenInverted(m) {
  const flutter = (m.mem8[FRAME_TICK] & ALTERNATION_BIT) === 0 ? 0 : SHAPE_STEP;
  put(m, FIRST_SHAPE + flutter, SECOND_SHAPE + flutter);
}

/** BUG: one pair of shapes is used whatever the counter says, so nothing flutters. */
function brokenNoFlutter(m) {
  put(m, FIRST_SHAPE, SECOND_SHAPE);
}

/** BUG: the two shapes go into each other's slots. */
function brokenSlotsSwapped(m) {
  const flutter = (m.mem8[FRAME_TICK] & ALTERNATION_BIT) === 0 ? SHAPE_STEP : 0;
  put(m, SECOND_SHAPE + flutter, FIRST_SHAPE + flutter);
}

/** BUG: the other pair is one further on, so the flutter walks instead of alternating. */
function brokenStepTooBig(m) {
  const flutter = (m.mem8[FRAME_TICK] & ALTERNATION_BIT) === 0 ? SHAPE_STEP + 1 : 0;
  put(m, FIRST_SHAPE + flutter, SECOND_SHAPE + flutter);
}

const TWINS = [
  ["no-op", brokenNoOp, 768],
  ["wrong-bit", brokenWrongBit, 384],
  ["inverted", brokenInverted, 768],
  ["no-flutter", brokenNoFlutter, 384],
  ["slots-swapped", brokenSlotsSwapped, 768],
  ["step-too-big", brokenStepTooBig, 384],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: no tape dispatches this entry, which is why the states are sampled", { skip }, () => {
  const IN0 = 0xc300;
  const IN1 = 0xc320;
  const turning = [
    { frame: 401, port: IN0, bits: 0x01, dur: 8 },
    { frame: 501, port: IN0, bits: 0x08, dur: 8 },
    { frame: 601, port: IN1, bits: 0x10, dur: CORPUS_FRAMES },
    { frame: 700, port: IN1, bits: 0x05, dur: CORPUS_FRAMES },
  ];
  for (const [label, opts] of [["shared", {}], ["attract", ATTRACT], ["turning", { tape: turning }]]) {
    let hits = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => (hits++, oracle(mm))]]), opts);
    m.runFrames(CORPUS_FRAMES);
    assert.equal(hits, 0, `the ${label} tape now reaches this entry, so it has a real corpus`);
  }
  console.log("  UNREACHED: shared, attract and a turning tape all dispatch it 0 times");
});

test("EQUAL on every sampled real state, with nothing masked", { skip }, () => {
  const states = realStates();
  assert.equal(states.length, SAMPLES, "the number of sampled states moved");
  let bad = 0;
  for (const s of states) if (unitDiff(dressSpriteFlutterShapesByFrameTickBit, s)) bad++;
  assert.equal(bad, 0, `the rewrite diverged on ${bad} of ${states.length} sampled states`);
  console.log(`  EQUAL: ${states.length} real states, identical on each with nothing masked`);
});

test("NOT VACUOUS: a no-op candidate FAILS on a sampled state", { skip }, () => {
  const d = unitDiff(brokenNoOp, realStates()[0]);
  assert.notEqual(d, null, "the diff passed a candidate that does nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: bounded over the whole crafted space", { skip }, () => {
  const moved = movedRegisters(dressSpriteFlutterShapesByFrameTickBit);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("BOTH ARMS: the sweep presents both states of the deciding bit", { skip }, () => {
  const seen = new Set(COUNTERS.map((c) => (c & ALTERNATION_BIT) === 0));
  assert.deepEqual([...seen].sort(), [false, true], "the sweep covers only one arm");
  console.log("  BOTH ARMS: 128 counter values either side of the deciding bit");
});

test("EXHAUSTIVE: all 256 counter values on three sprite-entry bases", { skip }, () => {
  assert.equal(sweepCaught(dressSpriteFlutterShapesByFrameTickBit), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} comparisons identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} crafted entries`);
  });
}
