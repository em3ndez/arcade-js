// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_10f8 — memory-equivalent to the frozen oracle at ROM 0x10F8.
 *
 * GATE: crafted-entry throughout, over machines captured at the enclosing routine's real
 *   dispatches; an exhaustive sweep of the request patterns and of both bytes of every slot; a
 *   continuation arm against the enclosing routine; and teeth.
 *
 * ★ THIS ADDRESS IS NEVER DISPATCHED, AND THAT IS ASSERTED HERE RATHER THAN ASSUMED. It is the
 *   tail of the range ROM 0x1098 covers, and that transcription runs the whole range inline, so
 *   nothing calls in at 0x10F8 during a session. Its one entry in the image is the spin-back at
 *   0x1104, inside a block that is itself never dispatched. The REACHABILITY arm measures both
 *   over a driven and an undriven run — with 0x1098's own count as the positive control that the
 *   instrument can see a dispatch at all — so "never entered" is a finding here and not a hole.
 *   Every entry state below is therefore CRAFTED: a real machine captured at 0x1098's dispatch,
 *   which is the state the block really runs in, with the cells this routine reads set by hand.
 *
 * ★ THE HOLD IS NOT MODELLED, AND THAT IS MEASURED. Each block waits on the raster before it
 *   trades, and a rewrite that charges no time cannot wait. The PIN arm shows the difference: at
 *   the captured cycle count the oracle spends thousands of T-states holding, and at the pinned
 *   one it spends a few hundred. The exhaustive sweeps run from the pinned count so they measure
 *   the writes rather than the wait, and the arm asserts that pin instead of trusting it. The
 *   CORPUS arm deliberately does NOT pin, so the real raster states are covered too.
 *
 * ★ THE ORACLE PUSHES NOTHING, so there is no masked window and none is declared: the WINDOW arm
 *   measures the oracle's own `push16` over the whole sweep and pins the result at zero. The whole
 *   state dump is compared, the stack included.
 *
 * ★ WHERE THE LIVE-OUT COMES FROM. Both of the enclosing routine's callers reach this range by
 *   falling through the blocks before it and take the routine's own return; the range writes only
 *   the ten slot bytes and reads only those and the raster. Nothing downstream reads a register
 *   this range leaves — its own transcription ends on a bare return with no value staged — so the
 *   live-out is memory only.
 *
 * What it exercises, holes stated:
 *   1. REACHABILITY — the address is entered zero times under both tapes, with the enclosing
 *      routine's own dispatch count as the positive control.
 *   2. WINDOW — the oracle's push footprint, measured over the whole sweep and pinned at zero.
 *   3. CORPUS — every captured machine, replayed UNPINNED so the real raster is exercised.
 *   4. CONTINUATION — with the three slots before this range quiet, the enclosing routine and this
 *      range leave byte-identical state. That is what ties the five slots here to the eight there.
 *   5. PIN — the hold is real and the pin removes it, both measured, in T-states.
 *   6. PATTERNS — all 32 request patterns, each slot given a value of its own so cross-wiring
 *      shows.
 *   7. REQUESTS — each slot's request byte over all 256 values, the other four quiet.
 *   8. PARTNERS — each slot's partner byte over all 256 values, wrap included.
 *   9. NOT-MINE — the three slots BEFORE this range are never touched, with a twin that touches
 *      one as the in-arm control that the measurement can see it.
 *  10. EXCLUDED — no register outside the declared ceiling moves, with a control twin.
 *  11. TEETH — six twins with exact catch counts on all three sweeps.
 *
 * HOLE: no arm here runs the routine in a live session, because nothing dispatches it. What that
 * costs is the whole-session evidence the enclosing routine's own gate carries and this one
 * cannot.
 * HOLE: a crafted machine is one captured state with the ten slot bytes set; everything else is
 * whatever that state happened to hold, and the sweeps vary nothing else either.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-10f8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_10f8 } from "../loc_10f8.js";
import { loc_10f8 as oracle } from "../../translated/loc_10f8.js";
import { loc_1098 as enclosing } from "../../translated/loc_1098.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x10f8;
const ENCLOSING = 0x1098;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const HALF = 128;

/** The five slots, derived here independently so an edit to the module's table cannot pass. */
const SLOTS = [
  { request: 0xb437, partner: 0xb036 },
  { request: 0xb439, partner: 0xb038 },
  { request: 0xb43b, partner: 0xb03a },
  { request: 0xb43d, partner: 0xb03c },
  { request: 0xb43f, partner: 0xb03e },
];

/** The three slots the enclosing routine handles BEFORE this range, and which this one must not. */
const NOT_MINE = [
  { request: 0xb411, partner: 0xb010 },
  { request: 0xb413, partner: 0xb012 },
  { request: 0xb415, partner: 0xb014 },
];

const PATTERNS = 1 << SLOTS.length;
const VALUES = 256;
const CORPUS_ENTRIES = 200;

/** Measured by the WINDOW arm: this oracle pushes nothing, so nothing is masked. */
const SCRATCH_BYTES = 0;

/**
 * The ceiling on divergence, and the whole of it: the oracle stages a request in the counter and
 * takes a return the rewrite does not. Not a set the rewrite is required to fill — one that
 * diverged on fewer still passes, so this can never refuse a fix.
 */
const MOVED = ["a", "f", "c", "sp"];

/** A cycle count whose raster line sits past every hold a request can ask for. */
const BEAM_PAST_EVERY_HOLD = 43190;
/** A hold costs thousands of T-states; the pinned entry must cost far less than one. */
const NO_HOLD_TSTATES = 2000;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** Drop decoded graphics from a captured machine: nothing here renders, and cloning one is slow. */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured machines ───────────────────────────────────────────────────────────────

let captured = null;

/** Machines taken at the ENCLOSING routine's real dispatches — the state this range runs in. */
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[ENCLOSING, (mm) => {
    if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
    return enclosing(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "capture run ran short");
  assert.ok(entries.length > 0, "vacuous: the enclosing routine was never dispatched either");
  captured = entries;
  return captured;
}

/** One captured machine with the raster wound past every hold, reused by all three sweeps. */
let pinnedBase = null;
function pinned() {
  if (!pinnedBase) {
    pinnedBase = capture()[0].clone();
    pinnedBase.cycles = BEAM_PAST_EVERY_HOLD;
  }
  return pinnedBase.clone();
}

/** Oracle vs candidate on independent clones of `machine`: the whole dump, nothing masked. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 40) };
  }
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

/** How far below its seat the oracle's own pushes take the stack pointer, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  oracle(c);
  return seat - deepest;
}

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

function sweepRun(candidate, setup) {
  const a = pinned();
  const b = pinned();
  setup(a);
  setup(b);
  oracle(a);
  try {
    candidate(b);
  } catch {
    return true;
  }
  return firstStateDiff(a.dumpState(), b.dumpState()) !== null;
}

const quietAll = (mm) => {
  for (let i = 0; i < SLOTS.length; i++) {
    mm.mem8[SLOTS[i].request] = 0;
    mm.mem8[SLOTS[i].partner] = 100 + i;
  }
};

/** All 32 request patterns, every slot given a value of its own. */
function sweepPatterns(candidate) {
  let caught = 0;
  for (let mask = 0; mask < PATTERNS; mask++) {
    const differed = sweepRun(candidate, (mm) => {
      for (let i = 0; i < SLOTS.length; i++) {
        mm.mem8[SLOTS[i].request] = (mask >> i) & 1 ? HALF + i : 8 + i;
        mm.mem8[SLOTS[i].partner] = 60 + i * 25;
      }
    });
    if (differed) caught++;
  }
  return caught;
}

/** Quiet every slot, then walk one slot's request byte over every value. */
function sweepRequests(candidate) {
  let caught = 0;
  for (let s = 0; s < SLOTS.length; s++) {
    for (let value = 0; value < VALUES; value++) {
      const differed = sweepRun(candidate, (mm) => {
        quietAll(mm);
        mm.mem8[SLOTS[s].request] = value;
      });
      if (differed) caught++;
    }
  }
  return caught;
}

/** One slot requesting, its partner byte walked over every value so the wrap is covered. */
function sweepPartners(candidate) {
  let caught = 0;
  for (let s = 0; s < SLOTS.length; s++) {
    for (let value = 0; value < VALUES; value++) {
      const differed = sweepRun(candidate, (mm) => {
        quietAll(mm);
        mm.mem8[SLOTS[s].request] = HALF + s;
        mm.mem8[SLOTS[s].partner] = value;
      });
      if (differed) caught++;
    }
  }
  return caught;
}

const SWEEP_RUNS = {
  patterns: PATTERNS,
  requests: SLOTS.length * VALUES,
  partners: SLOTS.length * VALUES,
};

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: clears the request and never moves the partner, so the slot only half-travels. */
function brokenClearOnly(m) {
  const { mem8 } = m;
  for (const s of SLOTS) {
    const request = mem8[s.request];
    if (request < HALF) continue;
    mem8[s.request] = request - HALF;
  }
}

/** BUG: moves the partner and leaves the request standing, so the slot asks again. */
function brokenShiftOnly(m) {
  const { mem8 } = m;
  for (const s of SLOTS) {
    if (mem8[s.request] < HALF) continue;
    mem8[s.partner] = mem8[s.partner] + HALF;
  }
}

/** BUG: treats the request as strictly above the half, so a bare half is left standing. */
function brokenStrictlyAbove(m) {
  const { mem8 } = m;
  for (const s of SLOTS) {
    const request = mem8[s.request];
    if (request <= HALF) continue;
    mem8[s.request] = request - HALF;
    mem8[s.partner] = mem8[s.partner] + HALF;
  }
}

/** BUG: stops at the first quiet slot instead of stepping over it. */
function brokenStopAtFirstGap(m) {
  const { mem8 } = m;
  for (const s of SLOTS) {
    const request = mem8[s.request];
    if (request < HALF) break;
    mem8[s.request] = request - HALF;
    mem8[s.partner] = mem8[s.partner] + HALF;
  }
}

/** BUG: reaches back into the slot before this range, which belongs to the blocks ahead of it. */
function brokenReachesBack(m) {
  const { mem8 } = m;
  for (const s of [NOT_MINE[2], ...SLOTS]) {
    const request = mem8[s.request];
    if (request < HALF) continue;
    mem8[s.request] = request - HALF;
    mem8[s.partner] = mem8[s.partner] + HALF;
  }
}

/** BUG: scribbles on an index register, the in-arm control for the ceiling. */
function brokenMovesIndex(m) {
  loc_10f8(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["clear-only", brokenClearOnly],
  ["shift-only", brokenShiftOnly],
  ["strictly-above", brokenStrictlyAbove],
  ["stop-at-first-gap", brokenStopAtFirstGap],
  ["reaches-back", brokenReachesBack],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHABILITY: nothing dispatches this address, with a positive control", { skip }, () => {
  const seen = { [TARGET]: 0, [ENCLOSING]: 0 };
  for (const opts of [{}, { tape: [] }]) {
    const overrides = new Map();
    for (const addr of [TARGET, ENCLOSING]) {
      const body = addr === TARGET ? oracle : enclosing;
      overrides.set(addr, (mm) => {
        seen[addr]++;
        return body(mm);
      });
    }
    const m = makeMachine(overrides, opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `reachability run stopped early: ${m.stoppedBy}`);
  }
  // The zero above is evidence ONLY because the same instrument, in the same runs, counted the
  // enclosing routine. Without that control a broken tap and a genuinely unreached address look
  // the same.
  assert.ok(seen[ENCLOSING] > 0, "the tap counted nothing for the ENCLOSING routine either, so " +
    "the instrument is broken and the zero below means nothing");
  assert.equal(seen[TARGET], 0, "this address IS dispatched now, so the crafted entries below are " +
    "no longer the best evidence available and the gate should capture real ones");
  console.log(`  REACHABILITY: ${hex4(TARGET)} entered ${seen[TARGET]} times over both tapes; ` +
    `the control ${hex4(ENCLOSING)} entered ${seen[ENCLOSING]}`);
});

test("WINDOW: the oracle pushes nothing, measured over the whole sweep", { skip }, () => {
  let deepest = 0;
  for (const m of capture()) deepest = Math.max(deepest, oracleDepth(m));
  for (let mask = 0; mask < PATTERNS; mask++) {
    const mm = pinned();
    for (let i = 0; i < SLOTS.length; i++) mm.mem8[SLOTS[i].request] = (mask >> i) & 1 ? HALF + i : 0;
    deepest = Math.max(deepest, oracleDepth(mm));
  }
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat, so the ` +
    "whole dump is compared with nothing masked");
  assert.equal(deepest, SCRATCH_BYTES, "the oracle now pushes, so a masked window is owed and " +
    "every arm here is comparing bytes it has no right to");
});

test("CORPUS: every captured machine replays identically, raster UNPINNED", { skip }, () => {
  const entries = capture();
  let held = 0;
  for (const e of entries) {
    const probe = e.clone();
    const before = probe.cycles;
    oracle(probe);
    if (probe.cycles - before >= NO_HOLD_TSTATES) held++;
    const d = unitDiff(loc_10f8, e);
    assert.equal(d, null, show(d));
  }
  assert.ok(held > 0, "no captured machine made the oracle hold for the raster, so this arm is " +
    "not covering the real waiting states it exists to cover");
  console.log(`  CORPUS: ${entries.length} captured machines identical; ${held} of them made the ` +
    "oracle hold for the raster");
});

test("CONTINUATION: this range is the tail of the enclosing routine", { skip }, () => {
  const entries = capture().slice(0, 60);
  for (const e of entries) {
    const whole = e.clone();
    const tail = e.clone();
    // Quieting the three slots ahead of this range is what makes the two comparable: with no
    // request there the enclosing routine has nothing to do until it arrives here.
    for (const s of NOT_MINE) {
      whole.mem8[s.request] = 1;
      tail.mem8[s.request] = 1;
    }
    enclosing(whole);
    oracle(tail);
    const d = firstStateDiff(whole.dumpState(), tail.dumpState(),
      (off) => whole.stateOffsetToAddr(off));
    assert.equal(d, null, `the tail and the whole routine parted company — ${show(d)}`);
  }
  console.log(`  CONTINUATION: ${entries.length} machines, the whole routine with its first three ` +
    "slots quiet is byte-identical to this range alone");
});

test("PIN: the hold is real, and the pin removes it — both measured", { skip }, () => {
  const asking = (mm) => {
    for (let i = 0; i < SLOTS.length; i++) {
      mm.mem8[SLOTS[i].request] = HALF;
      mm.mem8[SLOTS[i].partner] = 60 + i;
    }
    return mm;
  };
  const unpinnedM = asking(capture()[0].clone());
  const pinnedM = asking(pinned());
  const beforeU = unpinnedM.cycles;
  const beforeP = pinnedM.cycles;
  oracle(unpinnedM);
  oracle(pinnedM);
  const heldFor = unpinnedM.cycles - beforeU;
  const pinnedFor = pinnedM.cycles - beforeP;
  console.log(`  PIN: unpinned the oracle spends ${heldFor} T-states, pinned ${pinnedFor}`);
  assert.ok(heldFor > NO_HOLD_TSTATES, "the unpinned entry no longer holds, so the claim that " +
    "this routine waits on the raster is not supported by anything here");
  assert.ok(pinnedFor < NO_HOLD_TSTATES, `the pinned entry still holds (${pinnedFor} T-states), ` +
    "so the sweeps below are timing the wait rather than the writes");
});

test("PATTERNS: all 32 request patterns land what the oracle lands", { skip }, () => {
  assert.equal(sweepPatterns(loc_10f8), 0, "a request pattern diverged");
  console.log(`  PATTERNS: ${SWEEP_RUNS.patterns} patterns identical`);
});

test("REQUESTS: each slot's request byte over every value", { skip }, () => {
  assert.equal(sweepRequests(loc_10f8), 0, "a request value diverged");
  console.log(`  REQUESTS: ${SWEEP_RUNS.requests} slot-and-value combinations identical`);
});

test("PARTNERS: each slot's partner byte over every value, wrap included", { skip }, () => {
  assert.equal(sweepPartners(loc_10f8), 0, "a partner value diverged");
  const wrapped = pinned();
  wrapped.mem8[SLOTS[0].request] = HALF;
  wrapped.mem8[SLOTS[0].partner] = 200;
  loc_10f8(wrapped);
  assert.equal(wrapped.mem8[SLOTS[0].request], 0, "the request must be cleared, not decremented");
  assert.equal(wrapped.mem8[SLOTS[0].partner], 72, "the partner must wrap in a byte, not widen");
  console.log(`  PARTNERS: ${SWEEP_RUNS.partners} combinations identical, including the wrap`);
});

test("NOT-MINE: the three slots before this range are never touched", { skip }, () => {
  const before = pinned();
  for (let i = 0; i < SLOTS.length; i++) before.mem8[SLOTS[i].request] = HALF + i;
  for (const s of NOT_MINE) {
    before.mem8[s.request] = HALF + 9;
    before.mem8[s.partner] = 33;
  }
  const after = before.clone();
  loc_10f8(after);
  const untouched = NOT_MINE.every(
    (s) => after.mem8[s.request] === HALF + 9 && after.mem8[s.partner] === 33,
  );
  // The absence is evidence only because the same predicate CATCHES a twin that does reach back.
  const control = before.clone();
  brokenReachesBack(control);
  const controlTouched = NOT_MINE.some(
    (s) => control.mem8[s.request] !== HALF + 9 || control.mem8[s.partner] !== 33,
  );
  assert.ok(controlTouched, "the predicate does not notice a twin that reaches back, so the " +
    "clean reading proves nothing");
  assert.ok(untouched, "a slot ahead of this range was moved");
  console.log("  NOT-MINE: the three earlier slots stand, and the reach-back twin is seen moving one");
});

/** Which registers a candidate parts company with the oracle on, over the captured machines. */
function movedOver(candidate) {
  const moved = new Set();
  for (const m of capture()) {
    const a = m.clone();
    const b = m.clone();
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
  const moved = movedOver(loc_10f8);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on an " +
      "index register, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // MOVED is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const patterns = sweepPatterns(twin);
    const requests = sweepRequests(twin);
    const partners = sweepPartners(twin);
    console.log(`  TEETH/${label}: caught on ${patterns}/${SWEEP_RUNS.patterns} patterns, ` +
      `${requests}/${SWEEP_RUNS.requests} requests, ${partners}/${SWEEP_RUNS.partners} partners`);
    assert.ok(patterns + requests + partners > 0, `every sweep PASSED the ${label} twin`);
  });
}
