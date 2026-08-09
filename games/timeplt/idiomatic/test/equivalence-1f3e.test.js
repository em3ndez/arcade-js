// SPDX-License-Identifier: GPL-3.0-only
/**
 * snapHeadingOntoTheTurnTarget — memory-equivalent to the frozen oracle at ROM 0x1F3E.
 *
 * GATE: crafted entries over machines captured at two real dispatches of the pipeline this block
 *   sits in; an exhaustive sweep of the handed-in heading and of the era byte the continuation
 *   keys on; a CONTINUATION arm that ties this block to the enclosing routine's own snap arm on
 *   real captured state; and a bench of broken twins with measured catch counts.
 *
 * ★ NEVER DISPATCHED, asserted not assumed: 0x1F3E is the tail of the range
 *   turnShipTowardTargetHeading covers inline, so nothing calls in here. REACHABILITY counts over
 *   three tapes (undriven attract; coin-then-start; coin-then-start with the stick walked round the
 *   compass), with turnShipTowardTargetHeading's and loc_1f42's own counts as the positive controls.
 *   Every entry below is therefore CRAFTED.
 *
 * ★ THE STICK TAPE IS LOAD-BEARING AND ITS ABSENCE WOULD BE INVISIBLE. turnShipTowardTargetHeading is the turn, and
 *   it is only entered when the panel names a direction. Under the shared coin-then-start tape the
 *   stick is never touched, the low nibble is zero on every frame, and turnShipTowardTargetHeading runs ZERO times —
 *   so a gate built on that tape alone would capture nothing of this pipeline and would look
 *   exactly like a gate whose routine is dead. The tape here walks all eight compass points.
 *
 * ★ THE CONTINUATION ARM is the strongest check: on a machine captured at a real turn dispatch the
 *   live heading is forced one step either side of the table target — the condition that reaches
 *   this block — and the whole enclosing routine vs this block alone must agree byte for byte, over
 *   every captured entry and both overshoot directions.
 *
 * ★ THE MASKED WINDOW IS MEASURED. The oracle parks one continuation address below its seat and
 *   nothing else; the BOUNDARY arm shows a scribble one byte below the window IS caught.
 *
 * Arms: 1 REACHABILITY (0 dispatches, 2 controls/run) · 2 WINDOW (footprint pinned at 2) ·
 *   3 BOUNDARY · 4 CORPUS (turn + scroll) · 5 NOT VACUOUS · 6 EXCLUDED (ceiling + control twin) ·
 *   7 HEADINGS (256) · 8 ERAS (256) · 9 CONTINUATION · 10 TEETH (broken twins, measured catches).
 *
 * HOLE: no arm here runs this block from a live dispatch, because nothing dispatches it. What that
 * costs is the whole-session evidence loc_1f42's own gate carries and this one cannot.
 * HOLE: between them the two captured corpora present two eras, and both are low ones. Every
 * higher era below is crafted, and nothing here says a real game ever presents one.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1f3e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent, COIN_FRAME, START_FRAME } from "./_harness.js";
import { snapHeadingOntoTheTurnTarget } from "../snapHeadingOntoTheTurnTarget.js";
import { loc_1f3e as oracle } from "../../translated/loc_1f3e.js";
import { loc_1f01 as enclosing } from "../../translated/loc_1f01.js";
import { loc_1f42 as continuation } from "../../translated/loc_1f42.js";
import { PLAYER_HEADING, ERA_INDEX } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x1f3e;
const ENCLOSING = 0x1f01;
const CONTINUATION = 0x1f42;
const FRAMES = 1500;

/** The direction table the enclosing routine reads, and the nibble mask it reads it with. */
const DIRECTION_TABLE = 0x1f2e;
const NIBBLE = 0x0f;

/** Measured by the WINDOW arm: the oracle parks one continuation address below its seat. */
const SCRATCH_BYTES = 2;

/**
 * The ceiling on register divergence, measured over both corpora and the crafted sweeps.
 *   a — the oracle stages the heading in A on its way to memory and the continuation reloads it.
 *   f — the stores and the era comparison set flags nothing downstream reads.
 *   d,e — the continuation leaves one velocity component here, by two different routes.
 *   h,l — the oracle walks HL through the sample table; the rewrite indexes instead.
 *   sp — the oracle takes the continuation's return and the rewrite leaves that to the seam.
 * A ceiling, not a demand — a rewrite that diverged on fewer of these still passes.
 */
const MOVED = ["a", "f", "d", "e", "h", "l", "sp"];

const VALUES = 256;
const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;
/** All eight compass points the panel can name, in the order the tape walks them. */
const COMPASS = [0x01, 0x02, 0x04, 0x08, 0x05, 0x06, 0x0a, 0x09];
const STICK_PERIOD = 37;
const STICK_FROM = 700;

/** Coin, start, then the stick held on one compass point after another for the rest of the run. */
function stickTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
  ];
  let i = 0;
  for (let f = STICK_FROM; f < FRAMES; f += STICK_PERIOD) {
    tape.push({ frame: f, port: IN1, bits: COMPASS[i % COMPASS.length], dur: STICK_PERIOD });
    i++;
  }
  return tape;
}

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
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
  try {
    candidate(b);
  } catch (e) {
    // A JavaScript fault is a bug in THIS file, not a divergence — swallowing one reports a
    // broken twin as a caught twin. Only a machine-level raise counts as an outcome here.
    if (e instanceof ReferenceError || e instanceof TypeError) throw e;
    return { addr: null, a: "returned", b: String(e).slice(0, 60) };
  }
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

function pushDepth(body, machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  body(c);
  return (seat - deepest) & 0xffff;
}

/** Drop decoded graphics from a captured machine: nothing here renders, and cloning one is slow. */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured machines ───────────────────────────────────────────────────────────────

const CAPTURE_LIMIT = 60;
/** Take every tenth dispatch, not the first sixty: consecutive frames all hold the same stick. */
const CAPTURE_STRIDE = 10;
const corpora = new Map();

/** Machines taken at a real dispatch of the pipeline this block belongs to, spread over the run. */
function capture(label, addr, body, tape) {
  if (corpora.has(label)) return corpora.get(label);
  const entries = [];
  let seen = 0;
  const m = makeMachine(new Map([[addr, (mm) => {
    if (seen % CAPTURE_STRIDE === 0 && entries.length < CAPTURE_LIMIT) entries.push(lean(mm.clone()));
    seen++;
    return body(mm);
  }]]), { tape });
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "capture run ran short");
  assert.ok(entries.length > 0,
    `vacuous: ${label} was never dispatched either, so there is no state to craft onto`);
  corpora.set(label, entries);
  return entries;
}

const atTurn = () => capture("turn", ENCLOSING, enclosing, stickTape());
/** The continuation's own corpus comes from the UNDRIVEN demo — a different arm of the pipeline. */
const atScroll = () => capture("scroll", CONTINUATION, continuation, []);

function entryState() {
  const e = atTurn()[0] ?? null;
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  return e;
}

/** A captured machine with the handed-in heading, and optionally the era, forced. */
function craft(heading, era = null, from = entryState()) {
  const m = from.clone();
  m.regs.b = heading;
  if (era !== null) m.mem8[ERA_INDEX] = era;
  return m;
}

function sweepHeadings(candidate) {
  let caught = 0;
  for (let heading = 0; heading < VALUES; heading++) {
    if (unitDiff(candidate, craft(heading))) caught++;
  }
  return caught;
}

const ERA_PROBE_HEADINGS = [0x00, 0x3f, 0x40, 0x80, 0xc1];

function sweepEras(candidate) {
  let caught = 0;
  for (const heading of ERA_PROBE_HEADINGS) {
    for (let era = 0; era < VALUES; era++) {
      if (unitDiff(candidate, craft(heading, era))) caught++;
    }
  }
  return caught;
}

const SWEEP_RUNS = { headings: VALUES, eras: ERA_PROBE_HEADINGS.length * VALUES };

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: stores the heading and never moves the world for it. */
function brokenNoScroll(m) {
  m.mem8[PLAYER_HEADING] = m.regs.b;
}

/** BUG: moves the world for the heading that was already standing, never storing the target. */
function brokenNoStore(m) {
  continuation(m);
}

/** BUG: stores whatever is in the accumulator instead of the handed-in target. */
function brokenStoresAccumulator(m) {
  m.mem8[PLAYER_HEADING] = m.regs.a;
  continuation(m);
}

/** BUG: stores the target one step out — the overshoot this block exists to undo, left in. */
function brokenOffByOne(m) {
  m.mem8[PLAYER_HEADING] = (m.regs.b + 1) & 0xff;
  continuation(m);
}

/** BUG: stores into the neighbouring byte of the record, the one a turn aims at. */
function brokenNeighbouringByte(m) {
  m.mem8[PLAYER_HEADING - 1] = m.regs.b;
  continuation(m);
}

/** BUG: moves the world first and stores afterwards, so the scroll uses the stale heading. */
function brokenWrongOrder(m) {
  continuation(m);
  m.mem8[PLAYER_HEADING] = m.regs.b;
}

/** BUG: scribbles on an index register — the in-arm control for the register ceiling. */
function brokenMovesIndex(m) {
  snapHeadingOntoTheTurnTarget(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-scroll", brokenNoScroll],
  ["no-store", brokenNoStore],
  ["stores-accumulator", brokenStoresAccumulator],
  ["off-by-one", brokenOffByOne],
  ["neighbouring-byte", brokenNeighbouringByte],
  ["wrong-order", brokenWrongOrder],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHABILITY: nothing dispatches this address, with positive controls", { skip }, () => {
  const tapes = [["undriven", []], ["coin-then-start", undefined], ["stick", stickTape()]];
  const totals = {};
  for (const [label, tape] of tapes) {
    const seen = { [TARGET]: 0, [ENCLOSING]: 0, [CONTINUATION]: 0 };
    const overrides = new Map();
    for (const [addr, body] of [[TARGET, oracle], [ENCLOSING, enclosing], [CONTINUATION, continuation]]) {
      overrides.set(addr, (mm) => {
        seen[addr]++;
        return body(mm);
      });
    }
    const m = makeMachine(overrides, tape === undefined ? {} : { tape });
    m.runFrames(FRAMES);
    assert.equal(m.stoppedBy, null, `reachability run stopped early: ${m.stoppedBy}`);
    totals[label] = seen;
    // The zero is evidence ONLY because the same tap, in the same run, counted the continuation.
    assert.ok(seen[CONTINUATION] > 0,
      `${label}: the tap counted nothing for the continuation either, so the instrument is broken ` +
        "and the zero below means nothing");
    assert.equal(seen[TARGET], 0,
      `${label}: this address IS dispatched now, so the crafted entries below are no longer the ` +
        "best evidence available and the gate should capture real ones");
  }
  // And the tape that walks the stick is what makes the turn run at all — the shared tape does not.
  assert.equal(totals["coin-then-start"][ENCLOSING], 0,
    "the shared tape now reaches the turn, so the stick tape below is no longer load-bearing and " +
      "the header's claim about it is stale");
  assert.ok(totals.stick[ENCLOSING] > 0,
    "the stick tape does not reach the turn either, so this gate has no enclosing routine to " +
      "capture at and every crafted entry below is arbitrary state");
  for (const [label, seen] of Object.entries(totals)) {
    console.log(`  REACHABILITY/${label}: ${hex4(TARGET)} entered ${seen[TARGET]} times; controls ` +
      `${hex4(ENCLOSING)} ${seen[ENCLOSING]}, ${hex4(CONTINUATION)} ${seen[CONTINUATION]}`);
  }
});

test("WINDOW: the oracle's stack footprint, measured over every corpus", { skip }, () => {
  let deepest = 0;
  for (const corpus of [atTurn(), atScroll()]) {
    for (const e of corpus) deepest = Math.max(deepest, pushDepth(oracle, e));
  }
  for (let heading = 0; heading < VALUES; heading += 17) {
    deepest = Math.max(deepest, pushDepth(oracle, craft(heading)));
  }
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is the wrong width and every arm here is comparing the wrong bytes");
});

test("BOUNDARY: the mask hides the window and nothing else", { skip }, () => {
  const e = craft(0x37);
  const sp = e.regs.sp;
  const scribble = (offset) => (m) => {
    snapHeadingOntoTheTurnTarget(m);
    m.mem8[(sp + offset) & 0xffff] = (m.mem8[(sp + offset) & 0xffff] ^ 0xff) & 0xff;
  };
  assert.equal(unitDiff(scribble(-1), e), null, "a byte inside the window is not masked");
  assert.notEqual(unitDiff(scribble(-SCRATCH_BYTES - 1), e), null,
    "a byte one below the window is masked too, so the window is wider than it claims");
  assert.notEqual(unitDiff(scribble(0), e), null, "the seat itself is masked");
  console.log(`  BOUNDARY: ${hex4(sp - 1)} masked, ${hex4(sp - SCRATCH_BYTES - 1)} caught, ` +
    `${hex4(sp)} caught`);
});

test("CORPUS: both captured corpora replay identically", { skip }, () => {
  const report = [];
  for (const [label, corpus] of [["turn", atTurn()], ["scroll", atScroll()]]) {
    for (const e of corpus) {
      for (const heading of [0x00, 0x20, 0x80, 0xe0, e.regs.b]) {
        const d = unitDiff(snapHeadingOntoTheTurnTarget, craft(heading, null, e));
        assert.equal(d, null, `${label}: ${show(d)}`);
      }
    }
    const eras = [...new Set(corpus.map((e) => e.mem8[ERA_INDEX]))].sort((x, y) => x - y);
    report.push(`${label}: ${corpus.length} machines, eras present ${eras.join(", ")}`);
  }
  console.log(`  CORPUS: ${report.join("; ")}`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(0x37));
  assert.notEqual(d, null, "the masked comparison passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell, not on an exception");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

/** Which registers a candidate parts company with the oracle on, over both corpora. */
function movedOver(candidate) {
  const moved = new Set();
  const machines = [];
  for (const corpus of [atTurn().slice(0, 12), atScroll().slice(0, 12)]) {
    for (const e of corpus) for (const heading of [0x00, 0x91]) machines.push(craft(heading, null, e));
  }
  for (const machine of machines) {
    const a = machine.clone();
    const b = machine.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(snapHeadingOntoTheTurnTarget);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on an " +
      "index register, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // A CEILING, not a demand: deepEqual against MOVED would go RED on a rewrite that became
  // register-exact, which is a gate refusing the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register diverged outside the excluded set");
});

test("HEADINGS: all 256 values of the handed-in heading", { skip }, () => {
  assert.equal(sweepHeadings(snapHeadingOntoTheTurnTarget), 0, "a heading value diverged");
  const landed = new Set();
  for (let heading = 0; heading < VALUES; heading += 37) {
    const m = craft(heading);
    snapHeadingOntoTheTurnTarget(m);
    landed.add(m.mem8[PLAYER_HEADING] === heading);
  }
  assert.deepEqual([...landed], [true], "the handed-in heading is not what lands in the cell");
  console.log(`  HEADINGS: ${SWEEP_RUNS.headings} values identical, each landing in the cell whole`);
});

test("ERAS: all 256 era values, at several headings", { skip }, () => {
  assert.equal(sweepEras(snapHeadingOntoTheTurnTarget), 0, "an era value diverged");
  console.log(`  ERAS: ${SWEEP_RUNS.eras} era-and-heading combinations identical`);
});

test("CONTINUATION: the enclosing routine's snap arm IS this block", { skip }, () => {
  const corpus = atTurn();
  let compared = 0;
  const targets = new Set();
  for (const e of corpus) {
    const target = e.mem8[DIRECTION_TABLE + (e.regs.a & NIBBLE)];
    targets.add(target);
    // One step to either side of the target is exactly the condition that reaches this block:
    // 3 does not divide the 32-step spacing, so the walk overshoots to one past rather than landing on it.
    for (const overshoot of [1, -1]) {
      const whole = e.clone();
      whole.mem8[PLAYER_HEADING] = (target + overshoot) & 0xff;
      const tail = whole.clone();
      tail.regs.b = target;
      const sp = e.regs.sp;
      enclosing(whole);
      snapHeadingOntoTheTurnTarget(tail);
      const d = allDiffs(whole, tail).find((x) => !inScratch(x.addr, sp)) ?? null;
      assert.equal(d, null, `the whole turn and this block parted company — ${show(d)}`);
      compared++;
    }
  }
  // A whole routine agreeing with its tail proves nothing if the tail is all there is: the arm
  // needs the enclosing routine to have really run its prefix, which the varying targets show.
  assert.ok(targets.size > 1,
    "every captured entry presents the same target heading, so this arm exercised one path of the " +
      "enclosing routine and calls it agreement");
  console.log(`  CONTINUATION: ${compared} comparisons over ${corpus.length} captured turns, ` +
    `${targets.size} distinct target headings, byte-identical outside the window`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const headings = sweepHeadings(twin);
    const eras = sweepEras(twin);
    console.log(`  TEETH/${label}: caught on ${headings}/${SWEEP_RUNS.headings} headings, ` +
      `${eras}/${SWEEP_RUNS.eras} era combinations`);
    assert.ok(headings + eras > 0, `both sweeps PASSED the ${label} twin`);
  });
}
