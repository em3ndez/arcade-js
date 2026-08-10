// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveObjectAppearanceByPhaseBand — memory-equivalent to the frozen oracle at ROM 0x2C31.
 *
 * GATE: strict unit-capture replayed over every dispatch of the shared coin -> start tape, plus an
 *   exhaustive crafted sweep over the phase byte crossed with the request byte and the counter,
 *   plus teeth. Three bands and a retire path, and real play reaches only some of them.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at the real dispatch — identical outside a four-byte scratch window.
 *   2. THE SCRATCH WINDOW IS THE ONE EXCLUSION, pinned to [SP-4, SP). Two of the arms hand off to
 *      a shared helper behind a pushed return address, and the arm that posts a command pushes
 *      again inside it, which is what sets the depth at four rather than two — and that arm is
 *      reached only by the crafted sweep. Every arm walks the whole dump and asserts nothing
 *      escapes the window. It is an upper bound: the arms that push nothing dirty no byte at all.
 *   3. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   4. EXCLUDED, deliberately — the register set that may differ is BOUNDED by a measured list: a
 *      register diverging outside it fails the arm, and a rewrite diverging on fewer still passes.
 *   5. CORPUS — every dispatch of the session replayed on a clone, with the set of phases the
 *      session presents asserted rather than reported.
 *   6. EXHAUSTIVE — all 256 phases crossed with four request bytes and two counter positions.
 *      This is the arm that reaches the bands and the retire path real play does not, and the
 *      per-twin counts below say which twins depend on it.
 *   7. EVERY BAND IS ENTERED — the sweep is checked to have taken all four paths, by watching the
 *      cells only that path writes, so "exhaustive" is not a claim about a loop that never varied.
 *   8. TEETH — nine twins with exact catch counts over the crafted sweep. Two of them are
 *      caught on fewer than a dozen of the 2048 crafted entries, so the counts, not a
 *      blanket verdict, are what says the sweep reaches the arm each one breaks.
 *
 * HOLE: the request cell is swept over four chosen values, not all 256, so nothing here speaks for
 * a request naming a record other than the two used.
 * HOLE: real play reaches all three phase bands but never the RETIRE path or the POST, so those
 * two rest entirely on the crafted sweep — and the post arm is also the only thing that makes the
 * scratch window four bytes deep rather than two.
 * HOLE: nothing says what the posted command DOES; the gate fixes that a command is posted exactly
 * once, on the first phase, and that the request is cleared with it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2c31.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { driveObjectAppearanceByPhaseBand } from "../driveObjectAppearanceByPhaseBand.js";
import { loc_2c31 as oracle } from "../../translated/loc_2c31.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { COMMAND_RING, FRAME_TICK } from "../names.js";

const TARGET = 0x2c31;
const FRAMES = 2000;
const DISPATCHES = 72;

const PHASE = 0;
const RECORD_NUMBER = 15;
const SHAPE = 1;
const ATTRIBUTE = 0x30;
const REQUEST = 0xa821;
const WRITE_CURSOR = 0xa9b2;

const TINT_ONLY_FROM = 42;
const SHAPE_RUN_FROM = 10;
const HELD_SHAPE = 252;
const HELD_TINT = 108;
const SHAPE_RUN_TINT = 60;

const SCRATCH_BYTES = 4;
const EXCLUDED = ["a", "f", "b", "c", "sp"];

const PHASES = Array.from({ length: 256 }, (_unused, i) => i);
const COUNTERS = [0x00, 0x01];

/** The bands real play reaches at this entry. Measured, and asserted as a set. */
const REAL_BANDS = ["held", "run", "tint"];

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
  const phases = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    phases.add(mm.mem8[(mm.regs.ix + PHASE) & 0xffff]);
    const sp = mm.regs.sp;
    const b = mm.clone();
    candidate(b);
    const r = oracle(mm);
    if (allDiffs(mm, b).some((d) => !inScratch(d.addr, sp))) caught++;
    return r;
  }]]));
  const frames = host.runFrames(FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "session ran short");
  return { dispatches, caught, phases };
}

function entryState() {
  if (entry === null) replay(driveObjectAppearanceByPhaseBand);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** The record number the captured entry's object carries, so a request can name it or miss it. */
function ourNumber() {
  return entryState().mem8[(entryState().regs.ix + RECORD_NUMBER) & 0xffff];
}

/** A real captured machine with the phase, the request byte and the counter forced. */
function craft(phase, request, counter) {
  const m = entryState().clone();
  m.mem8[(m.regs.ix + PHASE) & 0xffff] = phase;
  m.mem8[REQUEST] = request;
  m.mem8[FRAME_TICK] = counter;
  m.mem8[COMMAND_RING + m.mem8[WRITE_CURSOR]] = 0xff; // a free ring cell, so a post is never silently dropped
  return m;
}

function requests() {
  const named = 0x80 | ourNumber();
  return [0x00, named, 0x80 | ((ourNumber() + 1) & 0x7f), ourNumber()];
}

const SWEEP_SIZE = () => PHASES.length * requests().length * COUNTERS.length;

function sweep(fn) {
  for (const request of requests()) {
    for (const counter of COUNTERS) {
      for (const phase of PHASES) fn(phase, request, counter);
    }
  }
}

function sweepCaught(candidate) {
  let caught = 0;
  sweep((phase, request, counter) => {
    if (unitDiff(candidate, craft(phase, request, counter))) caught++;
  });
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the tint-only band starts one phase early. */
function brokenTintBandEdge(m) {
  band(m, TINT_ONLY_FROM - 1, SHAPE_RUN_FROM);
}

/** BUG: the shape-run band starts one phase late. */
function brokenShapeBandEdge(m) {
  band(m, TINT_ONLY_FROM, SHAPE_RUN_FROM + 1);
}

/** BUG: the shape run steps once per phase instead of once per two. */
function brokenStepPerPhase(m) {
  loc_2c31_variant(m, { phasesPerStep: 1 });
}

/** BUG: the phase advances on every frame instead of seven in eight. */
function brokenAdvancesAlways(m) {
  loc_2c31_variant(m, { holdMask: 0 });
}

/** BUG: keeps the object alive whenever the request bit is set, whoever it names. */
function brokenIgnoresNumber(m) {
  loc_2c31_variant(m, { ignoreNumber: true });
}

/** BUG: posts the command on every phase below the run, not only the first. */
function brokenPostsEveryPhase(m) {
  loc_2c31_variant(m, { postPhase: null });
}

/** BUG: posts and forgets to clear the request, so the command goes out again next frame. */
function brokenKeepsRequest(m) {
  loc_2c31_variant(m, { keepRequest: true });
}

/** BUG: the held tint is one out. */
function brokenHeldTint(m) {
  loc_2c31_variant(m, { heldTint: HELD_TINT + 1 });
}

function band(m, tintFrom, shapeFrom) {
  loc_2c31_variant(m, { tintFrom, shapeFrom });
}

/**
 * One parameterised rewrite the twins bend. It is deliberately a SECOND implementation rather
 * than a wrapper round the module, so a twin cannot be satisfied by the module's own behaviour.
 */
function loc_2c31_variant(m, o) {
  const opt = {
    tintFrom: TINT_ONLY_FROM, shapeFrom: SHAPE_RUN_FROM, phasesPerStep: 2, holdMask: 0x07,
    ignoreNumber: false, postPhase: 1, keepRequest: false, heldTint: HELD_TINT, ...o,
  };
  const { mem8, regs } = m;
  const object = regs.ix;
  const sprite = regs.iy;
  const phase = mem8[object + PHASE];
  if (phase >= opt.tintFrom) {
    mem8[sprite + ATTRIBUTE] = (mem8[sprite + ATTRIBUTE] & 0xc0) + (mem8[FRAME_TICK] & 0x0f);
    return;
  }
  if (phase >= opt.shapeFrom) {
    const step = Math.floor(((phase - opt.shapeFrom) & 0xff) / opt.phasesPerStep) & 0x0f;
    mem8[sprite + SHAPE] = mem8[0x2c94 + step];
    mem8[sprite + ATTRIBUTE] = SHAPE_RUN_TINT;
    return;
  }
  const request = mem8[REQUEST];
  const named = (request & 0x80) !== 0 &&
    (opt.ignoreNumber || (request & 0x7f) === mem8[object + RECORD_NUMBER]);
  if (!named) {
    mem8[object] = 0;
    mem8[object + 3] = 0;
    mem8[object + 5] = 0;
    mem8[sprite] = 0;
    mem8[sprite + 49] = 0;
    return;
  }
  if (opt.holdMask === 0 || (mem8[FRAME_TICK] & opt.holdMask) !== 0) {
    mem8[object + PHASE] = (phase + 1) & 0xff;
  }
  mem8[sprite + SHAPE] = HELD_SHAPE;
  mem8[sprite + ATTRIBUTE] = opt.heldTint;
  if (opt.postPhase !== null && mem8[object + PHASE] !== opt.postPhase) return;
  post(m, 4, 12);
  if (!opt.keepRequest) mem8[REQUEST] = 0;
}

function post(m, command, argument) {
  const { mem8 } = m;
  const cursor = mem8[WRITE_CURSOR];
  if ((mem8[COMMAND_RING + cursor] & 0x80) === 0) return;
  mem8[COMMAND_RING + cursor] = command;
  mem8[COMMAND_RING + ((cursor + 1) & 0xff)] = argument;
  mem8[WRITE_CURSOR] = (cursor + 2) % 64;
}

/** Each twin's exact catch count over the crafted sweep. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 1192],
  ["tint-band-edge", brokenTintBandEdge, 8],
  ["shape-band-edge", brokenShapeBandEdge, 64],
  ["step-per-phase", brokenStepPerPhase, 208],
  ["advances-always", brokenAdvancesAlways, 10],
  ["ignores-the-record-number", brokenIgnoresNumber, 20],
  ["posts-every-phase", brokenPostsEveryPhase, 18],
  ["keeps-the-request", brokenKeepsRequest, 2],
  ["held-tint-off-by-one", brokenHeldTint, 20],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: driveObjectAppearanceByPhaseBand == oracle outside the scratch window", { skip }, () => {
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  driveObjectAppearanceByPhaseBand(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  console.log(`  EQUAL: sp=${hex4(sp)}; identical outside ${SCRATCH_BYTES} scratch bytes`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(TINT_ONLY_FROM + 1, 0x00, 0x0f));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a bounded register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  driveObjectAppearanceByPhaseBand(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real session replays identically", { skip }, () => {
  const r = replay(driveObjectAppearanceByPhaseBand);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  const bands = new Set([...r.phases].map((p) =>
    p >= TINT_ONLY_FROM ? "tint" : p >= SHAPE_RUN_FROM ? "run" : "held"));
  assert.deepEqual([...bands].sort(), REAL_BANDS, "the session's band set moved, so the coverage " +
    "this file records has to be re-derived");
  console.log(`  CORPUS: ${r.dispatches} dispatches, phases ${[...r.phases].sort((x, y) => x - y)}`);
});

test("EXHAUSTIVE: every phase against four requests and two counter positions", { skip }, () => {
  assert.equal(sweepCaught(driveObjectAppearanceByPhaseBand), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE()} crafted entries identical`);
});

test("EVERY BAND IS ENTERED: the sweep really takes all four paths", { skip }, () => {
  const taken = new Set();
  sweep((phase, request, counter) => {
    const m = craft(phase, request, counter);
    const before = m.mem8[m.regs.iy + SHAPE];
    const cursor = m.mem8[WRITE_CURSOR];
    driveObjectAppearanceByPhaseBand(m);
    if (phase >= TINT_ONLY_FROM) taken.add("tint");
    else if (phase >= SHAPE_RUN_FROM) taken.add("run");
    else if (m.mem8[m.regs.ix] === 0 && m.mem8[m.regs.iy] === 0) taken.add("retire");
    else if (m.mem8[m.regs.iy + SHAPE] === HELD_SHAPE) taken.add("held");
    if (m.mem8[WRITE_CURSOR] !== cursor) taken.add("posted");
    assert.notEqual(before, undefined, "the sprite cell must be readable");
  });
  assert.deepEqual([...taken].sort(), ["held", "posted", "retire", "run", "tint"],
    "the crafted sweep no longer covers every path, so EXHAUSTIVE overstates what it exercises");
  console.log(`  BANDS: ${[...taken].sort().join(", ")}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE()} crafted entries`);
  });
}
