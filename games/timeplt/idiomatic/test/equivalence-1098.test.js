// SPDX-License-Identifier: GPL-3.0-only
/**
 * multiplexSpriteSlots — memory-equivalent to the frozen oracle at ROM 0x1098.
 *
 * GATE: strict unit-capture, a captured corpus over two tapes, three crafted sweeps over the
 *   eight slots, and all three callers replayed whole. Registers are dropped by the contract,
 *   so `equal` is false for a CORRECT routine and only `ram` is asserted.
 *
 * ★ NOT BLIND AT THE FIRST DISPATCH. Every slot carries its request there, so a bare no-op
 *   DIVERGES. That is asserted rather than assumed, because the opposite — a first entry the
 *   routine has nothing to do at — is what this shape of gate usually hides, and no larger
 *   frame budget would fix it: unitEquivalence clones the FIRST entry.
 *
 * ★ THE CAPTURED CORPUS VARIES BUT IS FAR FROM COMPLETE. Play produces a minority of the 256
 *   request patterns, so a twin that only differs on a pattern play does not reach is invisible
 *   to it. Sweep A walks all 256 on a crafted entry; sweeps B and C walk each slot's two bytes
 *   over every value, which is where the byte wrap and the exact-half request are covered.
 *
 * ★ THE HOLD IS NOT MODELLED, AND IT IS LOAD-BEARING FOR THE HOST. The oracle waits on the
 *   raster between reading a slot and moving it, and a stackless rewrite that charges no
 *   T-states cannot wait. The last arm MEASURES what that costs — a live cycle-driven run does
 *   not survive the substitution — instead of claiming it, and that is why there is no
 *   whole-session arm here. The crafted sweeps therefore start from a cycle count whose raster
 *   line is already past every hold, so they measure the writes and not the wait; the sweep arm
 *   asserts that pin instead of trusting it.
 *
 * What it exercises, holes stated:
 *   1. CONTRACT — unitEquivalence at the real dispatch: RAM identical.
 *   2. NOT BLIND — the no-op is CAUGHT at that same dispatch.
 *   3. CORPUS — every distinct slot state a driven and an undriven run produce, each replayed
 *      from its own captured machine.
 *   4. EXCLUDED — {a, f, c, sp} and pc diverge by design and nothing else does, at every
 *      captured state. What licenses dropping the three registers is the callers: each loads
 *      the accumulator again before it reads one, and none reads the counter or the flags. The
 *      caller arm is the falsifiable version of that claim.
 *   5. SWEEP A — all 256 request patterns, a distinct value per slot so cross-wiring shows.
 *   6. SWEEP B — each slot's request byte over all 256 values, the other seven quiet.
 *   7. SWEEP C — each slot's partner byte over all 256 values, including the wrap.
 *   8. CALLERS — all three, each under both tapes, run whole with the rewrite underneath. The
 *      rewrite leaves the caller's pushed return standing, so the stack pointer ends two bytes
 *      low and pc lands elsewhere; both are pinned, RAM is not excused anywhere.
 *   9. TEETH — six twins, with exact catch counts on all three sweeps and a per-state
 *      PREDICATE on the corpus, so each twin's blind spots are pinned rather than averaged out.
 *
 * HOLE: a corpus entry is one machine per distinct slot state; everything outside the sixteen
 * slot bytes is whatever that entry happened to hold, and the sweeps vary nothing else either.
 *
 * HOLE: each caller arm is a single captured entry per tape, so a twin that needs a slot value
 * those entries do not hold is invisible there — measured, not assumed, for the strictly-above
 * twin, which no caller entry catches and which the sweeps carry instead.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1098.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { multiplexSpriteSlots } from "../multiplexSpriteSlots.js";
import { loc_1098 as oracle } from "../../translated/loc_1098.js";
import { loc_1199 } from "../../translated/loc_1199.js";
import { loc_16af } from "../../translated/loc_16af.js";
import { loc_5694 } from "../../translated/loc_5694.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x1098;
const HALF = 128;

/** The eight slots, derived here independently so an edit to the module's table cannot pass. */
const SLOTS = [
  { request: 0xb411, partner: 0xb010 },
  { request: 0xb413, partner: 0xb012 },
  { request: 0xb415, partner: 0xb014 },
  { request: 0xb437, partner: 0xb036 },
  { request: 0xb439, partner: 0xb038 },
  { request: 0xb43b, partner: 0xb03a },
  { request: 0xb43d, partner: 0xb03c },
  { request: 0xb43f, partner: 0xb03e },
];

const CORPUS_FRAMES = 1200;
const SESSION_FRAMES = 700;
const MIN_CORPUS = 300;
const EXCLUDED = ["a", "f", "c", "sp"];

const DRIVEN = {};
const UNDRIVEN = { tape: [] };

/** A cycle count whose raster line sits past every hold a request can ask for. */
const BEAM_PAST_EVERY_HOLD = 43190;

/** A hold costs thousands of T-states; the pinned entry must cost far less than one. */
const NO_HOLD_TSTATES = 2000;

const skip = romsPresent() ? false : "ROM images absent";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** Which slots carry a request, as one byte: bit i is slot i. */
const requestMask = (mm) =>
  SLOTS.reduce((mask, s, i) => (mm.mem8[s.request] >= HALF ? mask | (1 << i) : mask), 0);

const isLeadingRun = (mask) => (mask & (mask + 1)) === 0;
const holdsExactHalf = (mm) => SLOTS.some((s) => mm.mem8[s.request] === HALF);

/** Drop decoded graphics from a captured machine: nothing here renders, and cloning one is slow. */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

const stateKey = (mm) => SLOTS.map((s) => `${mm.mem8[s.request]}.${mm.mem8[s.partner]}`).join(":");

/** One pristine machine per distinct slot state, over a driven and an undriven run. */
function captureCorpus() {
  if (corpus) return corpus;
  const byState = new Map();
  let dispatches = 0;
  for (const opts of [DRIVEN, UNDRIVEN]) {
    const m = makeMachine(
      new Map([[TARGET, (mm) => {
        dispatches++;
        const key = stateKey(mm);
        if (!byState.has(key)) byState.set(key, lean(mm.clone()));
        return oracle(mm);
      }]]),
      opts,
    );
    m.runFrames(CORPUS_FRAMES);
  }
  corpus = { entries: [...byState.values()], dispatches };
  return corpus;
}

/** Oracle vs candidate on independent clones of one entry, compared on RAM alone. */
function ramDiff(candidate, entry) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

let crafted = null;

/** One captured machine with the raster wound past every hold, reused by all three sweeps. */
function craftedEntry() {
  if (crafted) return crafted;
  crafted = captureCorpus().entries[0].clone();
  crafted.cycles = BEAM_PAST_EVERY_HOLD;
  return crafted;
}

function sweepRun(candidate, setup) {
  const a = craftedEntry().clone();
  const b = craftedEntry().clone();
  setup(a);
  setup(b);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState()) !== null;
}

/** All 256 request patterns, every slot given a value of its own. */
function sweepPatterns(candidate) {
  let caught = 0;
  const seen = new Set();
  for (let mask = 0; mask < 256; mask++) {
    seen.add(mask);
    const differed = sweepRun(candidate, (mm) => {
      for (let i = 0; i < SLOTS.length; i++) {
        mm.mem8[SLOTS[i].request] = (mask >> i) & 1 ? HALF + i : 8 + i;
        mm.mem8[SLOTS[i].partner] = 60 + i * 25;
      }
    });
    if (differed) caught++;
  }
  return { caught, patterns: seen.size };
}

/** Quiet every slot, then walk one slot's request byte over every value. */
function sweepRequests(candidate) {
  let caught = 0;
  let runs = 0;
  for (let s = 0; s < SLOTS.length; s++) {
    for (let value = 0; value < 256; value++) {
      runs++;
      const differed = sweepRun(candidate, (mm) => {
        for (let i = 0; i < SLOTS.length; i++) {
          mm.mem8[SLOTS[i].request] = 0;
          mm.mem8[SLOTS[i].partner] = 100 + i;
        }
        mm.mem8[SLOTS[s].request] = value;
      });
      if (differed) caught++;
    }
  }
  return { caught, runs };
}

/** One slot requesting, its partner byte walked over every value so the wrap is covered. */
function sweepPartners(candidate) {
  let caught = 0;
  let runs = 0;
  for (let s = 0; s < SLOTS.length; s++) {
    for (let value = 0; value < 256; value++) {
      runs++;
      const differed = sweepRun(candidate, (mm) => {
        for (let i = 0; i < SLOTS.length; i++) {
          mm.mem8[SLOTS[i].request] = 0;
          mm.mem8[SLOTS[i].partner] = 100 + i;
        }
        mm.mem8[SLOTS[s].request] = HALF + s;
        mm.mem8[SLOTS[s].partner] = value;
      });
      if (differed) caught++;
    }
  }
  return { caught, runs };
}

// ── the callers ─────────────────────────────────────────────────────────────────────────

const FAMILY = [
  { addr: 0x16af, fn: loc_16af },
  { addr: 0x1199, fn: loc_1199 },
  { addr: 0x5694, fn: loc_5694 },
];

let callers = null;

/** One pristine machine per caller per tape, taken the first time that caller runs. */
function captureCallers() {
  if (callers) return callers;
  const out = [];
  for (const [tape, opts] of [["driven", DRIVEN], ["undriven", UNDRIVEN]]) {
    for (const c of FAMILY) {
      let entry = null;
      const m = makeMachine(
        new Map([[c.addr, (mm) => {
          if (entry === null) entry = lean(mm.clone());
          return c.fn(mm);
        }]]),
        opts,
      );
      m.runFrames(CORPUS_FRAMES);
      if (entry !== null) out.push({ ...c, tape, entry });
    }
  }
  callers = out;
  return callers;
}

/** Run one caller whole with `impl` wired underneath, counting dispatches, surviving a throw. */
function runCaller(caller, impl) {
  const m = caller.entry.clone();
  m.routines = new Map(m.routines);
  let fired = 0;
  m.routines.set(TARGET, (mm) => {
    fired++;
    return impl(mm);
  });
  try {
    caller.fn(m);
  } catch (e) {
    return { m, fired, threw: e.name };
  }
  return { m, fired, threw: null };
}

/** Oracle-underneath vs candidate-underneath over the caller's whole body, on RAM. */
function callerDiff(caller, candidate) {
  const a = runCaller(caller, oracle);
  const b = runCaller(caller, candidate);
  if (a.fired === 0) throw new Error(`vacuous: ${hex4(caller.addr)} never reached the routine`);
  if (a.threw !== null) throw new Error(`${hex4(caller.addr)} threw ${a.threw} under the oracle`);
  if (b.threw !== null) return { why: `threw ${b.threw}`, a, b };
  if (a.fired !== b.fired) return { why: `dispatches ${a.fired} vs ${b.fired}`, a, b };
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  return ram === null ? null : { why: show(ram), a, b };
}

// ── the whole session ───────────────────────────────────────────────────────────────────

/** A live cycle-driven run, `impl` wired at the target or the oracle left in place. */
function runSession(impl) {
  let fired = 0;
  const overrides = impl
    ? new Map([[TARGET, (mm) => {
        fired++;
        return impl(mm);
      }]])
    : undefined;
  const m = makeMachine(overrides);
  let threw = null;
  let frames = [];
  try {
    frames = m.runFrames(SESSION_FRAMES);
  } catch (e) {
    threw = e.name;
    frames = m.frames;
  }
  return { frames, fired, threw, stoppedBy: m.stoppedBy, offToAddr: (o) => m.stateOffsetToAddr(o) };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: multiplexSpriteSlots == oracle on RAM at the real dispatch", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, multiplexSpriteSlots, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  CONTRACT: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("NOT BLIND: a no-op is CAUGHT at that same first dispatch", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, () => {}, { maxFrames: ENTRY_FRAMES });
  assert.notEqual(
    r.ram,
    null,
    "the no-op passed the first dispatch, so that entry has become one the routine has " +
      "nothing to do at and the single-capture arm above is measuring nothing",
  );
  console.log(`  NOT BLIND: the no-op diverges at the captured entry — ${show(r.ram)}`);
});

test("CORPUS: every distinct captured slot state replays identically", { skip }, () => {
  const { entries, dispatches } = captureCorpus();
  assert.ok(dispatches > 0, "vacuous: neither tape reached the routine");
  assert.ok(entries.length >= MIN_CORPUS, `the corpus thinned to ${entries.length} states`);

  const quiet = entries.filter((e) => requestMask(e) === 0).length;
  const full = entries.filter((e) => requestMask(e) === 255).length;
  const patterns = new Set(entries.map((e) => requestMask(e)));
  assert.ok(quiet > 0, "no captured state has every slot quiet — the skip path is uncovered");
  assert.ok(full > 0, "no captured state has every slot requesting");

  for (const entry of entries) {
    const d = ramDiff(multiplexSpriteSlots, entry);
    assert.equal(d, null, `${stateKey(entry)} — ${show(d)}`);
  }
  console.log(
    `  CORPUS: ${dispatches} dispatches, ${entries.length} distinct states, ` +
      `${patterns.size} of 256 request patterns (${quiet} quiet, ${full} full)`,
  );
});

test("EXCLUDED, deliberately: only the dropped registers and pc diverge", { skip }, () => {
  const { entries } = captureCorpus();
  const widened = [];
  const union = new Set();
  for (const e of entries) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    multiplexSpriteSlots(b);
    for (const k of REG_FIELDS) {
      if (a.regs[k] === b.regs[k]) continue;
      union.add(k);
      if (!EXCLUDED.includes(k)) widened.push(`${stateKey(e)}: ${k}`);
    }
    assert.equal(a.pc === b.pc, false, "the oracle's return moves pc; the rewrite returns to JS");
  }
  assert.deepEqual(widened, [], "a register outside the excluded set diverged");
  assert.deepEqual(
    REG_FIELDS.filter((k) => union.has(k)),
    EXCLUDED,
    "the excluded set changed shape: only the accumulator, the flag byte, the counter the " +
      "oracle stages a request in and the stack pointer its return moves may differ",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc, over all ${entries.length} states`);
});

test("SWEEP A: all 256 request patterns land what the oracle lands", { skip }, () => {
  const pinned = craftedEntry().clone();
  for (let i = 0; i < SLOTS.length; i++) pinned.mem8[SLOTS[i].request] = HALF + i;
  const before = pinned.cycles;
  oracle(pinned);
  assert.ok(
    pinned.cycles - before < NO_HOLD_TSTATES,
    `the crafted entry still holds for the raster (${pinned.cycles - before} T-states), so the ` +
      "sweeps below are timing the wait rather than the writes",
  );

  const { caught, patterns } = sweepPatterns(multiplexSpriteSlots);
  assert.equal(patterns, 256, "the sweep did not walk every request pattern");
  assert.equal(caught, 0, "a request pattern diverged");
  console.log(`  SWEEP A: 256 patterns identical; the pin costs ${pinned.cycles - before} T-states`);
});

test("SWEEP B: each slot's request byte over every value", { skip }, () => {
  const { caught, runs } = sweepRequests(multiplexSpriteSlots);
  assert.equal(runs, 2048, "the sweep did not walk every slot and value");
  assert.equal(caught, 0, "a request value diverged");
  console.log(`  SWEEP B: ${runs} slot-and-value combinations identical`);
});

test("SWEEP C: each slot's partner byte over every value, wrap included", { skip }, () => {
  const { caught, runs } = sweepPartners(multiplexSpriteSlots);
  assert.equal(runs, 2048, "the sweep did not walk every slot and value");
  assert.equal(caught, 0, "a partner value diverged");

  const wrapped = craftedEntry().clone();
  wrapped.mem8[SLOTS[0].request] = HALF;
  wrapped.mem8[SLOTS[0].partner] = 200;
  multiplexSpriteSlots(wrapped);
  assert.equal(wrapped.mem8[SLOTS[0].request], 0, "the request must be cleared, not decremented");
  assert.equal(wrapped.mem8[SLOTS[0].partner], 72, "the partner must wrap in a byte, not widen");
  console.log(`  SWEEP C: ${runs} slot-and-value combinations identical, including the wrap`);
});

test("CALLERS: every caller is unchanged by wiring the rewrite underneath it", { skip }, () => {
  const reached = captureCallers();
  assert.equal(reached.length, 6, "each of the three callers must be captured under both tapes");
  for (const caller of reached) {
    const d = callerDiff(caller, multiplexSpriteSlots);
    assert.equal(d, null, `${hex4(caller.addr)} ${caller.tape}: ${d?.why}`);
  }
  console.log(`  CALLERS: ${reached.map((c) => `${hex4(c.addr)}/${c.tape}`).join(" ")} identical`);
});

test("CALLERS: the rewrite leaves the pushed return standing, by exactly two bytes", { skip }, () => {
  for (const caller of captureCallers()) {
    const a = runCaller(caller, oracle);
    const b = runCaller(caller, multiplexSpriteSlots);
    assert.equal(
      a.m.regs.sp - b.m.regs.sp,
      2 * a.fired,
      `${hex4(caller.addr)} ${caller.tape}: the leak is not two bytes per dispatch`,
    );
    assert.notEqual(a.m.pc, b.m.pc, `${hex4(caller.addr)} ${caller.tape}: pc must diverge`);
  }
  console.log("  CALLERS: two stack bytes per dispatch, no RAM excused for them anywhere");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Six ways to get this wrong. `sweptA/B/C` are the exact number of the sweep's runs that must
// CATCH each twin, and `visible` says, per captured state, whether the corpus can see it at
// all — a twin's blind spots are pinned rather than averaged into a total.

/** BUG: does nothing — the tell that a gate is measuring an unreached or idle entry. */
function brokenNoOp() {}

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

/** BUG: stops at the first quiet slot instead of skipping it. */
function brokenStopAtFirstGap(m) {
  const { mem8 } = m;
  for (const s of SLOTS) {
    const request = mem8[s.request];
    if (request < HALF) break;
    mem8[s.request] = request - HALF;
    mem8[s.partner] = mem8[s.partner] + HALF;
  }
}

/** BUG: moves the NEXT slot's partner, which is invisible while every slot is asking. */
function brokenCrossWired(m) {
  const { mem8 } = m;
  for (let i = 0; i < SLOTS.length; i++) {
    const request = mem8[SLOTS[i].request];
    if (request < HALF) continue;
    mem8[SLOTS[i].request] = request - HALF;
    const partner = SLOTS[(i + 1) % SLOTS.length].partner;
    mem8[partner] = mem8[partner] + HALF;
  }
}

const TWINS = [
  {
    label: "no-op",
    fn: brokenNoOp,
    sweptA: 255, sweptB: 1024, sweptC: 2048,
    visible: (e) => requestMask(e) !== 0,
  },
  {
    label: "strictly-above",
    fn: brokenStrictlyAbove,
    sweptA: 128, sweptB: 8, sweptC: 256,
    visible: (e) => holdsExactHalf(e),
  },
  {
    label: "clear-only",
    fn: brokenClearOnly,
    sweptA: 255, sweptB: 1024, sweptC: 2048,
    visible: (e) => requestMask(e) !== 0,
  },
  {
    label: "shift-only",
    fn: brokenShiftOnly,
    sweptA: 255, sweptB: 1024, sweptC: 2048,
    visible: (e) => requestMask(e) !== 0,
  },
  {
    label: "stop-at-first-gap",
    fn: brokenStopAtFirstGap,
    sweptA: 247, sweptB: 896, sweptC: 1792,
    visible: (e) => !isLeadingRun(requestMask(e)),
  },
  {
    label: "cross-wired",
    fn: brokenCrossWired,
    sweptA: 254, sweptB: 1024, sweptC: 2048,
    visible: (e) => requestMask(e) !== 0 && requestMask(e) !== 255,
  },
];

/** Caught at every caller entry, measured; the other three need a value no caller entry holds. */
const CAUGHT_AT_EVERY_CALLER = ["no-op", "clear-only", "shift-only"];

for (const twin of TWINS) {
  test(`TEETH: the ${twin.label} twin is CAUGHT exactly where the corpus can see it`, { skip }, () => {
    const { entries } = captureCorpus();
    const wrong = entries.filter((e) => (ramDiff(twin.fn, e) !== null) !== twin.visible(e));
    assert.deepEqual(
      wrong.map(stateKey),
      [],
      `the ${twin.label} twin was caught on states the corpus cannot see it on, or missed on ` +
        "states it can — either way the predicate beside the twin is now wrong",
    );
    const caught = entries.filter((e) => twin.visible(e)).length;
    assert.ok(caught > 0, `no captured state can see the ${twin.label} twin at all`);
    console.log(`  TEETH/${twin.label}: caught on ${caught} of ${entries.length} captured states`);
  });

  test(`TEETH: the ${twin.label} twin is CAUGHT by all three sweeps`, { skip }, () => {
    assert.equal(sweepPatterns(twin.fn).caught, twin.sweptA, `sweep A missed the ${twin.label} twin`);
    assert.equal(sweepRequests(twin.fn).caught, twin.sweptB, `sweep B missed the ${twin.label} twin`);
    assert.equal(sweepPartners(twin.fn).caught, twin.sweptC, `sweep C missed the ${twin.label} twin`);
    console.log(
      `  TEETH/${twin.label}: caught on ${twin.sweptA} of 256, ${twin.sweptB} of 2048 and ` +
        `${twin.sweptC} of 2048 crafted runs`,
    );
  });

  test(`TEETH: the ${twin.label} twin at the callers`, { skip }, () => {
    const reached = captureCallers();
    const caught = reached.filter((c) => callerDiff(c, twin.fn) !== null);
    if (CAUGHT_AT_EVERY_CALLER.includes(twin.label)) {
      assert.equal(caught.length, reached.length, `a caller ran clean with the ${twin.label} twin`);
    }
    const names = caught.map((c) => `${hex4(c.addr)}/${c.tape}`).join(" ");
    console.log(`  TEETH/${twin.label}: caught at ${caught.length} of ${reached.length} — ${names}`);
  });
}

test("NO SESSION ARM: the hold is load-bearing in a live cycle-driven run", { skip }, () => {
  const base = runSession(null);
  assert.equal(base.threw, null, `the all-oracle baseline threw ${base.threw}`);
  assert.equal(base.stoppedBy, null, `the all-oracle baseline stopped early: ${base.stoppedBy}`);
  assert.equal(base.frames.length, SESSION_FRAMES, "the all-oracle baseline is short of frames");

  const live = runSession(multiplexSpriteSlots);
  assert.ok(live.fired > 0, "vacuous: the rewrite never dispatched in the live run");
  let fork = null;
  for (let f = 0; f < Math.min(base.frames.length, live.frames.length) && fork === null; f++) {
    const d = firstStateDiff(base.frames[f], live.frames[f], base.offToAddr);
    if (d) fork = { f, ...d };
  }
  assert.ok(
    live.threw !== null || fork !== null,
    "the live run survived the cycle-free rewrite for the whole session, so the raster hold " +
      "is no longer load-bearing here and a real whole-session arm is now available",
  );
  console.log(
    `  NO SESSION ARM: ${live.fired} dispatches, forked at frame ${fork?.f}` +
      `${live.threw ? ` and then threw ${live.threw}` : ""}`,
  );
});
