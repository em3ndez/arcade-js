// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4fe0 — memory-equivalent to the frozen oracle at ROM 0x4FE0.
 *
 * WHAT IT IS. A sweep of six slots for one a single roaming thing has reached: both must be live,
 * and both coordinates must fall inside a box whose first axis is widened by two of the era values.
 * A slot that passes is destroyed with the roamer and the chained hit score is posted for it. That
 * score routine is ALREADY decompiled, so the rewrite calls postChainedHitScore directly and
 * dissolving that call belongs to this caller's unit.
 *
 * ★ NO TAPE REACHES THIS ENTRY, and the UNREACHED arm asserts it: the shared tape, undriven attract
 *   and a driven turning tape each dispatch it ZERO times in the corpus budget — the arm above it
 *   sends control the other way on every pass. So the corpus here is REAL MACHINE STATES sampled at
 *   the dispatches of the routine whose body this entry is the tail of. Every arm below is a
 *   crafted entry on one of those states, and nothing here claims a natural dispatch.
 *
 * ★ THE FROZEN LAYER TRANSCRIBES THIS BODY TWICE — once as its own routine and once inside the
 *   routine that falls into it — so the oracle this file compares against is the standalone one,
 *   which is the only one the registry can dispatch.
 *
 * GATE: crafted entries on real machine states, sweeping each axis of the box exhaustively. What it
 *   exercises, holes stated:
 *
 *   1. UNREACHED — three tapes, zero dispatches each, asserted.
 *   2. EQUAL on real states — RAM identical outside the dead stack bytes, at every sampled state.
 *   3. NOT VACUOUS — a candidate that does nothing FAILS somewhere in the crafted space.
 *   4. EXCLUDED, DELIBERATELY — the union of every register that differs anywhere in the crafted
 *      space, asserted as a set.
 *   5. CRAFTED — each axis swept over all 256 wrapped differences, on BOTH widths of the box, plus
 *      the four combinations of the two liveness gates. The axis sweeps are what pin the window
 *      edges; the gate combinations are what pin the two early exits.
 *   6. BOTH WIDTHS ARE REAL — the sweep is asserted to contain a difference that the wide box
 *      admits and the narrow one does not, so the era dimension is not decorative.
 *   7. TEETH — seven twins, each with an exact catch count.
 *
 * HOLE: there is no whole-machine arm, because no session dispatches this entry; wiring the rewrite
 * over the address would pass vacuously. Nothing here speaks for whether the registers it leaves
 * are dead — arm 4 pins WHICH ones move, not that nothing reads them.
 * HOLE: the sweep moves the roamer against slots that all hold the same coordinates, so it cannot
 * distinguish which of the six slots a hit came from; the multiple-hit twin is what covers the
 * sweep not stopping at the first.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4fe0.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { loc_4fe0 } from "../loc_4fe0.js";
import { postChainedHitScore } from "../postChainedHitScore.js";
import { ERA_INDEX } from "../names.js";
import { loc_4fe0 as oracle } from "../../translated/loc_4fe0.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x4fe0;
/** The routine whose body this entry is the tail of; its dispatches supply the real states. */
const SAMPLED_AT = 0x4fbf;

const SLOTS = 0xaa80;
const SLOT_COUNT = 6;
const RECORD_STRIDE = 16;
const STATE = 0;
const SLOT_FIRST_AXIS = 6;
const SLOT_SECOND_AXIS = 4;

const ROAMER_STATE = 0xa8a0;
const ROAMER_FIRST_AXIS = 0xaa24;
const ROAMER_SECOND_AXIS = 0xaa55;

const LIVE = 255;
const DESTROYED = 240;

const WIDE_ERA = 0;
const NARROW_ERA = 1;
const FIRST_AXIS_REACH_WIDE = 8;
const FIRST_AXIS_SPAN_WIDE = 17;
const FIRST_AXIS_REACH = 6;
const FIRST_AXIS_SPAN = 13;
const SECOND_AXIS_REACH = 23;
const SECOND_AXIS_SPAN = 31;

const SCRATCH_BYTES = 8;

/**
 * Every register the oracle moves and the rewrite does not, read off the ROM body: the two box
 * dimensions land in H/L and D/E, the slot count lands in B and is counted down to zero, A and F
 * carry each comparison, the slot cursor lives in IY, and the closing `ret` lifts SP by two. C is
 * NOT among them — nothing between 0x4FE0 and 0x5031 writes it, and neither does the chained-score
 * routine the hit arm calls. IX and the shadow bank are untouched on both sides.
 */
const EXCLUDED = ["a", "f", "b", "d", "e", "h", "l", "iy", "sp"];

const CORPUS_FRAMES = 4000;
const SAMPLES = 151;
const ATTRACT = { tape: [] };

const skip = romsPresent() ? false : "ROM images are not assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const u8 = (v) => v & 0xff;

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

/** A sampled real state with the era, both liveness gates and the roamer's position forced. */
const ANCHOR = 100;
function craft(era, firstDiff, secondDiff, roamerLive, slotLive) {
  const m = realStates()[0].clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[ROAMER_STATE] = roamerLive ? LIVE : DESTROYED;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = SLOTS + i * RECORD_STRIDE;
    m.mem8[slot + STATE] = slotLive ? LIVE : DESTROYED;
    m.mem8[slot + SLOT_FIRST_AXIS] = ANCHOR;
    m.mem8[slot + SLOT_SECOND_AXIS] = ANCHOR;
  }
  m.mem8[ROAMER_FIRST_AXIS] = u8(ANCHOR + firstDiff);
  m.mem8[ROAMER_SECOND_AXIS] = u8(ANCHOR + secondDiff);
  return m;
}

let crafted = null;
function craftedSpace() {
  if (crafted === null) {
    crafted = [];
    for (const era of [WIDE_ERA, NARROW_ERA]) {
      for (let d = 0; d < 256; d++) crafted.push(craft(era, d, 0, true, true));
      for (let d = 0; d < 256; d++) crafted.push(craft(era, 0, d, true, true));
      for (const roamerLive of [true, false]) {
        for (const slotLive of [true, false]) crafted.push(craft(era, 0, 0, roamerLive, slotLive));
      }
    }
  }
  return crafted;
}
const SWEEP_SIZE = () => craftedSpace().length;

function sweepCaught(candidate) {
  let caught = 0;
  for (const machine of craftedSpace()) if (unitDiff(candidate, machine)) caught++;
  return caught;
}

function movedRegisters(candidate) {
  const moved = new Set();
  for (const machine of craftedSpace()) {
    const a = machine.clone();
    const b = machine.clone();
    oracle(a);
    candidate(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return REG_FIELDS.filter((k) => moved.has(k));
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

const within = (a, b, reach, span) => u8(u8(a - b) + reach) < span;

/** The shape every twin varies, so each differs from the rewrite in exactly one decision. */
function sweep(m, { wide = null, gateRoamer = true, gateSlot = true, stopAtFirst = false, secondAxis = true }) {
  const { mem8 } = m;
  const isWide = wide ?? [0, 4].includes(mem8[ERA_INDEX]);
  const reach = isWide ? FIRST_AXIS_REACH_WIDE : FIRST_AXIS_REACH;
  const span = isWide ? FIRST_AXIS_SPAN_WIDE : FIRST_AXIS_SPAN;
  if (gateRoamer && mem8[ROAMER_STATE] !== LIVE) return;
  let slot = SLOTS;
  for (let left = SLOT_COUNT; left !== 0; left--) {
    const liveSlot = !gateSlot || mem8[slot + STATE] === LIVE;
    const hit =
      liveSlot &&
      within(mem8[ROAMER_FIRST_AXIS], mem8[slot + SLOT_FIRST_AXIS], reach, span) &&
      (!secondAxis ||
        within(mem8[ROAMER_SECOND_AXIS], mem8[slot + SLOT_SECOND_AXIS], SECOND_AXIS_REACH, SECOND_AXIS_SPAN));
    if (hit) {
      mem8[ROAMER_STATE] = DESTROYED;
      mem8[slot + STATE] = DESTROYED;
      postChainedHitScore(m);
      if (stopAtFirst) return;
    }
    slot = (slot & 0xff00) | u8(slot + RECORD_STRIDE);
  }
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the box is always the wide one, so a later era hits from further away. */
const brokenAlwaysWide = (m) => sweep(m, { wide: true });

/** BUG: the box is always the narrow one. */
const brokenAlwaysNarrow = (m) => sweep(m, { wide: false });

/** BUG: the roamer's own liveness is not checked, so a destroyed one keeps killing. */
const brokenNoRoamerGate = (m) => sweep(m, { gateRoamer: false });

/** BUG: a slot's liveness is not checked, so an empty slot can be destroyed. */
const brokenNoSlotGate = (m) => sweep(m, { gateSlot: false });

/** BUG: the sweep stops at the first hit, so one pass can never take two. */
const brokenStopsAtFirst = (m) => sweep(m, { stopAtFirst: true });

/** BUG: only the first axis is tested, so the box is a stripe. */
const brokenOneAxis = (m) => sweep(m, { secondAxis: false });

/**
 * The catch counts, derived from the shape of the crafted space rather than read off a run. Each
 * era contributes 256 first-axis entries (second axis parked at a difference the box admits), 256
 * second-axis entries (first axis parked likewise) and the 4 gate combinations. The wide first-axis
 * box admits 17 of the 256 wrapped differences, the narrow one 13 — a subset — so 4 differences
 * separate them; the second-axis box admits 31. Every slot in a crafted entry carries the same
 * coordinates, so a pass either takes all six or none.
 *
 *   no-op          — caught wherever the oracle writes at all, i.e. wherever a hit lands:
 *                    wide 17 + 31 + 1 gate combination, narrow 13 + 31 + 1.
 *   always-wide    — only the narrow era can disagree, and only on the 4 differences the wide box
 *   always-narrow    admits and the narrow one does not; likewise the wide era for its twin.
 *   no-roamer-gate — the one gate combination per era with the roamer dead and the slots live.
 *   no-slot-gate   — the one gate combination per era with the roamer live and the slots dead.
 *   stops-at-first — caught wherever a hit lands, same as the no-op: the five slots it never
 *                    reaches keep the live code the oracle clears.
 *   one-axis       — caught on every second-axis entry the second box REJECTS, both eras:
 *                    2 x (256 - 31).
 */
const TWINS = [
  ["no-op", brokenNoOp, 94],
  ["always-wide", brokenAlwaysWide, 4],
  ["always-narrow", brokenAlwaysNarrow, 4],
  ["no-roamer-gate", brokenNoRoamerGate, 2],
  ["no-slot-gate", brokenNoSlotGate, 2],
  ["stops-at-first", brokenStopsAtFirst, 94],
  ["one-axis", brokenOneAxis, 450],
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

test("EQUAL on every sampled real state", { skip }, () => {
  const states = realStates();
  assert.equal(states.length, SAMPLES, "the number of sampled states moved");
  let bad = 0;
  for (const s of states) if (unitDiff(loc_4fe0, s)) bad++;
  assert.equal(bad, 0, `the rewrite diverged on ${bad} of ${states.length} sampled states`);
  console.log(`  EQUAL: ${states.length} real states, identical on each`);
});

test("NOT VACUOUS: a no-op candidate FAILS in the crafted space", { skip }, () => {
  assert.ok(sweepCaught(brokenNoOp) > 0, "the diff passed a candidate that does nothing, everywhere");
  console.log(`  NOT VACUOUS: the empty candidate is caught ${sweepCaught(brokenNoOp)} times`);
});

test("EXCLUDED, deliberately: pinned over the whole crafted space", { skip }, () => {
  assert.deepEqual(movedRegisters(loc_4fe0), EXCLUDED, "the excluded set changed shape");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("BOTH WIDTHS ARE REAL: a difference the wide box admits and the narrow one does not", { skip }, () => {
  const admits = (isWide, d) =>
    within(u8(ANCHOR + d), ANCHOR, isWide ? FIRST_AXIS_REACH_WIDE : FIRST_AXIS_REACH,
      isWide ? FIRST_AXIS_SPAN_WIDE : FIRST_AXIS_SPAN);
  const only = Array.from({ length: 256 }, (_unused, d) => d).filter((d) => admits(true, d) && !admits(false, d));
  assert.ok(only.length > 0, "the two box widths admit the same set, so the era dimension is inert");
  console.log(`  BOTH WIDTHS: ${only.length} differences separate the wide box from the narrow one`);
});

test("CRAFTED: both axes swept whole, on both box widths, plus the four gate combinations", { skip }, () => {
  assert.equal(sweepCaught(loc_4fe0), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  CRAFTED: ${SWEEP_SIZE()} comparisons identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE()} crafted entries`);
  });
}
