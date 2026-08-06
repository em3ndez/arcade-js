// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeAbuttingTile — memory-equivalent to the frozen oracle at ROM 0x3058.
 *
 * GATE: strict unit-capture, a captured corpus over two tapes, an exhaustive sweep of both
 *   source bytes, its reachable callers replayed whole, and a driven whole-session replay.
 *
 * ★ THE FIRST DISPATCH IS DEGENERATE. At the entry unitEquivalence captures, the two bytes this
 *   routine writes ALREADY hold the values it is about to write, so `ram: null` there is passed
 *   by a bare no-op. unitEquivalence clones the FIRST entry, so no larger frame budget reaches a
 *   better one. The BLIND test asserts this rather than leaving it as a silent property, and it
 *   is why the corpus, the sweep, the caller arms and the session carry the gate.
 *
 * ★ THE CURSOR STEP IS REGISTER-ONLY. A twin that writes both bytes correctly and leaves the two
 *   cursors standing is RAM-identical at EVERY captured entry — measured below, not assumed. It
 *   is caught by the declared live-out {ix, iy}, and one level up as a RAM divergence inside the
 *   callers, which is what makes that declaration falsifiable instead of a promise.
 *
 * What it exercises, holes stated:
 *   1. CONTRACT — unitEquivalence at the real dispatch: RAM identical. `equal` is not asserted;
 *      it folds in the register diff this contract deliberately drops.
 *   2. BLIND — the same call passes a no-op, for the reason above.
 *   3. CORPUS — every distinct (cursor, four touched bytes) state a driven and an undriven run
 *      produce, each replayed from its own captured machine, on RAM plus the live-out.
 *   4. EXCLUDED — {a, f, b, c, d, e, sp} and pc diverge by design and nothing else does, at
 *      every captured state. What licenses dropping the six is the callers: none of them reads
 *      one before loading it again. The stack pointer is the Z80 return, which the shim pays.
 *      Arms 6 and 7 are the falsifiable version of both claims.
 *   5. EXHAUSTIVE — both source bytes over all 65536 combinations, with the destination bytes
 *      primed to values the write MUST change, so no combination can pass a no-op by accident.
 *      This is where the byte wrap is covered; no captured state reaches it.
 *   6. CALLERS — each reachable caller run whole with the rewrite wired underneath it, diffed on
 *      RAM, both cursors, the stack pointer and pc.
 *   7. SESSION — 800 driven frames, RAM diffed every frame against an all-oracle baseline, with
 *      both runs asserted to have completed.
 *   8. TEETH — four twins, each caught by the corpus, the sweep, every caller arm and the
 *      session. Exact catch counts are asserted wherever the input space is enumerable.
 *
 * Arms 6 and 7 need a shim, `hosted()`. The host engine is cycle-driven and the oracle reaches
 * its return through a tail transfer, so a candidate that charges no T-states and does not take
 * that return would move the vblank interrupt and leak two stack bytes per dispatch. The shim
 * walks the SAME instruction addresses the oracle walks, not one lump tick: the interrupt pushes
 * whatever address it interrupts, that push lands in diffed work RAM, and a lump tick pushes the
 * wrong one — measured, a lump tick forks the real arm one frame after the first dispatch. The
 * shim belongs to the harness, and it is applied identically to the rewrite and to every twin.
 *
 * HOLE: one caller, 0x2D2D, is dispatched by neither tape within the corpus budget, so no arm
 * here covers it. 0x2D36 has the same three-part shape with a different mover in front and IS
 * covered, which is a resemblance argument, not a measurement of 0x2D2D.
 *
 * HOLE: two tapes. A cursor or byte pattern neither run reaches is covered only by the sweep,
 * which holds everything but the two source bytes at one captured machine's values.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3058.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { placeAbuttingTile } from "../placeAbuttingTile.js";
import { advanceToNextSlot } from "../advanceToNextSlot.js";
import { loc_3058 as oracle } from "../../translated/loc_3058.js";
import { loc_2d15 } from "../../translated/loc_2d15.js";
import { loc_2d21 } from "../../translated/loc_2d21.js";
import { loc_2d2d } from "../../translated/loc_2d2d.js";
import { loc_2d36 } from "../../translated/loc_2d36.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3058;

/** Frames per capture run. Play starts around 620, so this buys a few hundred frames of it. */
const CORPUS_FRAMES = 1200;
const SESSION_FRAMES = 800;

/** A floor, not the measurement: the corpus collapsing to a handful is itself a failure. */
const MIN_CORPUS = 400;

const LIVE_OUT = ["ix", "iy"];
const EXCLUDED = ["a", "f", "b", "c", "d", "e", "sp"];

/** Byte offsets from the entry cursor, in ascending order: the copied pair, the stepped pair. */
const STEPPED = 49;
const COPIED = 0;
const NEXT_STEPPED = 51;
const NEXT_COPIED = 2;
const TOUCHED = [COPIED, NEXT_COPIED, STEPPED, NEXT_STEPPED];

/** The addresses the oracle charges T-states at, in order, and the cost of each. */
const SITES = [
  [0x305b, 19], [0x305e, 19], [0x3060, 7], [0x3061, 4], [0x3064, 19], [0x3067, 19],
  [0x309b, 10], [0x309e, 10], [0x30a0, 15], [0x30a2, 10], [0x30a4, 10],
];
const RET_TSTATES = 10;

const UNDRIVEN = { tape: [] };
const DRIVEN = {};

const skip = romsPresent() ? false : "ROM images absent";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** Adapt a candidate to the cycle-driven host: walk the charged addresses, then return. */
function hosted(candidate) {
  return (mm) => {
    candidate(mm);
    for (const [addr, tstates] of SITES) mm.step(addr, tstates);
    mm.ret(RET_TSTATES);
  };
}

/**
 * Drop a captured machine's decoded graphics. Nothing here renders, and a corpus of thousands
 * of machines that each re-decode the sprite sheet on every clone is minutes of nothing.
 */
function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

const stateKey = (mm) =>
  [mm.regs.iy, ...TOUCHED.map((o) => mm.mem8[mm.regs.iy + o])].join(":");

/** One pristine machine per distinct state the routine is entered in, over both tapes. */
function captureCorpus() {
  if (corpus) return corpus;
  const byState = new Map();
  let dispatches = 0;
  let changing = 0;
  for (const opts of [DRIVEN, UNDRIVEN]) {
    const m = makeMachine(
      new Map([[TARGET, (mm) => {
        dispatches++;
        const iy = mm.regs.iy;
        const stepped = (mm.mem8[iy + STEPPED] + 16) & 0xff;
        if (stepped !== mm.mem8[iy + NEXT_STEPPED] || mm.mem8[iy] !== mm.mem8[iy + NEXT_COPIED]) {
          changing++;
        }
        const key = stateKey(mm);
        if (!byState.has(key)) byState.set(key, lean(mm.clone()));
        return oracle(mm);
      }]]),
      opts,
    );
    m.runFrames(CORPUS_FRAMES);
  }
  corpus = { entries: [...byState.values()], dispatches, changing };
  return corpus;
}

/** Oracle vs candidate on independent clones of one captured entry: RAM, then the live-out. */
function unitDiff(candidate, entry) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `ram ${hex4(ram.addr ?? 0)}: ${ram.a} vs ${ram.b}`;
  for (const k of LIVE_OUT) {
    if (a.regs[k] !== b.regs[k]) return `${k}: ${hex4(a.regs[k])} vs ${hex4(b.regs[k])}`;
  }
  return null;
}

/** The same comparison with the live-out dropped — what a RAM-only gate would see. */
function ramOnlyDiff(candidate, entry) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// ── the exhaustive sweep ────────────────────────────────────────────────────────────────

/**
 * Both source bytes over every combination, on one captured machine. The destination bytes are
 * primed to values the write must change, which is the case the real corpus does not contain:
 * with a real prior, a no-op is invisible wherever the object stood still.
 */
function sweep(candidate) {
  const entry = captureCorpus().entries[0];
  const a = entry.clone();
  const b = entry.clone();
  const iy = a.regs.iy;
  const ix = a.regs.ix;
  const sp = a.regs.sp;
  let caught = 0;
  for (let stepped = 0; stepped < 256; stepped++) {
    for (let copied = 0; copied < 256; copied++) {
      for (const mm of [a, b]) {
        mm.regs.ix = ix;
        mm.regs.iy = iy;
        mm.regs.sp = sp;
        mm.mem8[iy + STEPPED] = stepped;
        mm.mem8[iy + COPIED] = copied;
        mm.mem8[iy + NEXT_STEPPED] = stepped + 17;
        mm.mem8[iy + NEXT_COPIED] = copied + 1;
      }
      oracle(a);
      candidate(b);
      let differs = LIVE_OUT.some((k) => a.regs[k] !== b.regs[k]);
      for (const o of TOUCHED) if (a.mem8[iy + o] !== b.mem8[iy + o]) differs = true;
      if (differs) caught++;
    }
  }
  return caught;
}

// ── the callers ─────────────────────────────────────────────────────────────────────────

const FAMILY = [
  { addr: 0x2d15, fn: loc_2d15, opts: DRIVEN },
  { addr: 0x2d21, fn: loc_2d21, opts: UNDRIVEN },
  { addr: 0x2d2d, fn: loc_2d2d, opts: DRIVEN },
  { addr: 0x2d36, fn: loc_2d36, opts: DRIVEN },
];

let callers = null;

/** One pristine machine per caller, taken the first time that caller runs under its tape. */
function captureCallers() {
  if (callers) return callers;
  const found = new Map();
  for (const opts of [DRIVEN, UNDRIVEN]) {
    const overrides = new Map();
    for (const c of FAMILY) {
      overrides.set(c.addr, (mm) => {
        if (!found.has(c.addr)) found.set(c.addr, lean(mm.clone()));
        return c.fn(mm);
      });
    }
    makeMachine(overrides, opts).runFrames(CORPUS_FRAMES);
  }
  callers = FAMILY.filter((c) => found.has(c.addr)).map((c) => ({ ...c, entry: found.get(c.addr) }));
  return callers;
}

/** Run one caller whole, with `impl` wired at the address under test, counting its dispatches. */
function runCaller(caller, impl) {
  const m = caller.entry.clone();
  m.routines = new Map(m.routines);
  let fired = 0;
  m.routines.set(TARGET, (mm) => {
    fired++;
    return impl(mm);
  });
  caller.fn(m);
  return { m, fired };
}

/** Oracle-underneath vs candidate-underneath, over the caller's whole body. */
function callerDiff(caller, candidate) {
  const a = runCaller(caller, oracle);
  const b = runCaller(caller, hosted(candidate));
  if (a.fired === 0) throw new Error(`vacuous: ${hex4(caller.addr)} never reached the routine`);
  if (a.fired !== b.fired) return `dispatches ${a.fired} vs ${b.fired}`;
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  if (ram) return `ram ${hex4(ram.addr ?? 0)}: ${ram.a} vs ${ram.b}`;
  for (const k of [...LIVE_OUT, "sp"]) {
    if (a.m.regs[k] !== b.m.regs[k]) return `${k}: ${hex4(a.m.regs[k])} vs ${hex4(b.m.regs[k])}`;
  }
  return a.m.pc === b.m.pc ? null : `pc: ${hex4(a.m.pc)} vs ${hex4(b.m.pc)}`;
}

// ── the whole session ───────────────────────────────────────────────────────────────────

let baseline = null;

function baselineRun() {
  if (baseline) return baseline;
  const m = makeMachine();
  const frames = m.runFrames(SESSION_FRAMES);
  baseline = { frames, stoppedBy: m.stoppedBy, offToAddr: (off) => m.stateOffsetToAddr(off) };
  return baseline;
}

/** A full driven run with the candidate wired, diffed frame by frame against the baseline. */
function session(candidate) {
  const base = baselineRun();
  let fired = 0;
  const wired = hosted(candidate);
  const m = makeMachine(new Map([[TARGET, (mm) => {
    fired++;
    return wired(mm);
  }]]));
  const frames = m.runFrames(SESSION_FRAMES);
  let diff = null;
  for (let f = 0; f < Math.min(base.frames.length, frames.length) && !diff; f++) {
    const d = firstStateDiff(base.frames[f], frames[f], base.offToAddr);
    if (d) diff = { frame: f, ...d };
  }
  return {
    fired,
    diff,
    frames: frames.length,
    stoppedBy: m.stoppedBy,
    baseFrames: base.frames.length,
    baseStoppedBy: base.stoppedBy,
  };
}

/** Every session arm asserts the run COMPLETED — a truncated trace agrees about nothing. */
function assertSessionRan(s) {
  assert.equal(s.baseStoppedBy, null, `the baseline run stopped early: ${s.baseStoppedBy}`);
  assert.equal(s.stoppedBy, null, `the candidate run stopped early: ${s.stoppedBy}`);
  assert.equal(s.baseFrames, SESSION_FRAMES, "the baseline run is short of frames");
  assert.equal(s.frames, SESSION_FRAMES, "the candidate run is short of frames");
  assert.ok(s.fired > 0, "vacuous: the candidate never dispatched");
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: placeAbuttingTile == oracle on RAM at the real dispatch", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, placeAbuttingTile, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, `RAM diverged — ${JSON.stringify(r.ram)}`);
  console.log(`  CONTRACT: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("BLIND: the first dispatch writes what is already there, so RAM there passes a no-op", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, () => {}, { maxFrames: ENTRY_FRAMES });
  assert.equal(
    r.ram,
    null,
    "the no-op DIVERGED at the first dispatch — that entry is no longer degenerate, and the " +
      "note at the head of this file has to be re-derived",
  );
  console.log("  BLIND: a no-op is RAM-identical at the captured entry — the single arm is not the gate");
});

test("CORPUS: every captured entry state replays identically", { skip }, () => {
  const { entries, dispatches, changing } = captureCorpus();
  assert.ok(dispatches > 0, "vacuous: neither tape reached the routine");
  assert.ok(changing > 0, "vacuous: no captured dispatch actually changed a byte");
  assert.ok(
    entries.length >= MIN_CORPUS,
    `the corpus thinned to ${entries.length} states — a thin corpus is a weak gate`,
  );
  for (const entry of entries) {
    const d = unitDiff(placeAbuttingTile, entry);
    assert.equal(d, null, `${hex4(entry.regs.iy)}: ${d}`);
  }
  console.log(`  CORPUS: ${dispatches} dispatches (${changing} changing), ${entries.length} distinct states`);
});

test("EXCLUDED, deliberately: only the dropped registers and pc diverge", { skip }, () => {
  const { entries } = captureCorpus();
  const widened = [];
  for (const e of entries) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    placeAbuttingTile(b);
    const extra = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k] && !EXCLUDED.includes(k));
    if (extra.length) widened.push(`${hex4(e.regs.iy)}: ${extra.join(",")}`);
  }
  assert.deepEqual(widened, [], "a register outside the excluded set diverged");

  const a = entries[0].clone();
  const b = entries[0].clone();
  oracle(a);
  placeAbuttingTile(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    EXCLUDED,
    "the excluded set changed shape: only the scratch registers the oracle loads and the " +
      "stack pointer its return moves may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  for (const k of LIVE_OUT) assert.equal(a.regs[k], b.regs[k], `the live-out ${k} must match`);
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc, at all ${entries.length} states`);
});

test("EXHAUSTIVE: every source-byte pair writes what the oracle writes", { skip }, () => {
  assert.equal(sweep(placeAbuttingTile), 0, "the sweep found a source-byte pair that diverges");

  const entry = captureCorpus().entries[0].clone();
  const iy = entry.regs.iy;
  entry.mem8[iy + STEPPED] = 240;
  entry.mem8[iy + NEXT_STEPPED] = 99;
  placeAbuttingTile(entry);
  assert.equal(entry.mem8[iy + NEXT_STEPPED], 0, "the advance must wrap in a byte, not widen");
  console.log("  EXHAUSTIVE: 65536 source-byte pairs identical, including the byte wrap");
});

test("CALLERS: each reachable caller is unchanged by wiring the rewrite underneath it", { skip }, () => {
  const reached = captureCallers();
  const missing = FAMILY.filter((c) => !reached.some((r) => r.addr === c.addr));
  assert.ok(reached.length >= 3, `only ${reached.length} of the family dispatched — arm too thin`);
  for (const caller of reached) {
    const d = callerDiff(caller, placeAbuttingTile);
    assert.equal(d, null, `${hex4(caller.addr)}: ${d}`);
  }
  console.log(
    `  CALLERS: ${reached.map((c) => hex4(c.addr)).join(" ")} identical` +
      (missing.length ? `; NOT covered: ${missing.map((c) => hex4(c.addr)).join(" ")}` : ""),
  );
});

test("SESSION: 800 driven frames are byte-identical with the rewrite wired", { skip }, () => {
  const s = session(placeAbuttingTile);
  assertSessionRan(s);
  assert.equal(s.diff, null, `forked at frame ${s.diff?.frame} on ${hex4(s.diff?.addr ?? 0)}`);
  console.log(`  SESSION: ${s.frames} frames, ${s.fired} dispatches, RAM identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Four plausible ways to get this wrong. The no-op is the one a single-capture gate waves
// through; the no-advance twin is the one a RAM-only gate waves through at EVERY entry, which
// the corpus arm below asserts rather than assumes.

/** BUG: does nothing — the tell that a gate is measuring an unreached or degenerate entry. */
function brokenNoOp() {}

/** BUG: writes both bytes correctly but leaves the cursors, so the caller re-works one entry. */
function brokenNoAdvance(m) {
  const { mem8, regs } = m;
  const entry = regs.iy;
  mem8[entry + NEXT_STEPPED] = mem8[entry + STEPPED] + 16;
  mem8[entry + NEXT_COPIED] = mem8[entry + COPIED];
}

/** BUG: copies both coordinates straight through, so the two tiles land on top of each other. */
function brokenNoOffset(m) {
  const { mem8, regs } = m;
  const entry = regs.iy;
  mem8[entry + NEXT_STEPPED] = mem8[entry + STEPPED];
  mem8[entry + NEXT_COPIED] = mem8[entry + COPIED];
  advanceToNextSlot(m);
}

/** BUG: advances the coordinate in place instead of writing it to the following entry. */
function brokenSameEntry(m) {
  const { mem8, regs } = m;
  const entry = regs.iy;
  mem8[entry + STEPPED] = mem8[entry + STEPPED] + 16;
  advanceToNextSlot(m);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-advance", brokenNoAdvance],
  ["no-offset", brokenNoOffset],
  ["same-entry", brokenSameEntry],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on every captured state`, { skip }, () => {
    const { entries } = captureCorpus();
    const missed = entries.filter((e) => unitDiff(twin, e) === null);
    assert.equal(missed.length, 0, `the ${label} twin slipped ${missed.length} captured states`);
    const ramBlind = entries.filter((e) => ramOnlyDiff(twin, e) === null).length;
    console.log(`  TEETH/${label}: caught on all ${entries.length} states (RAM alone missed ${ramBlind})`);
  });

  test(`TEETH: the ${label} twin is CAUGHT on all 65536 source-byte pairs`, { skip }, () => {
    assert.equal(sweep(twin), 65536, `the sweep missed the ${label} twin somewhere`);
    console.log(`  TEETH/${label}: caught on every source-byte pair`);
  });

  test(`TEETH: the ${label} twin changes what every reachable caller leaves behind`, { skip }, () => {
    const reached = captureCallers();
    assert.ok(reached.length >= 3, "vacuous: the family barely dispatched");
    for (const caller of reached) {
      assert.notEqual(
        callerDiff(caller, twin),
        null,
        `${hex4(caller.addr)} ran clean with the ${label} twin underneath it`,
      );
    }
    console.log(`  TEETH/${label}: caught at ${reached.map((c) => hex4(c.addr)).join(" ")}`);
  });

  test(`TEETH: the ${label} twin FORKS the whole session`, { skip }, () => {
    const s = session(twin);
    assertSessionRan(s);
    assert.notEqual(s.diff, null, `the ${label} twin ran ${s.frames} frames clean`);
    console.log(`  TEETH/${label}: forked at frame ${s.diff.frame} on ${hex4(s.diff.addr ?? 0)}`);
  });
}

/**
 * The no-advance twin is the whole reason this file does not gate on RAM alone. Asserting it
 * outright means the day the cursor step starts leaving a memory trace, this file is told.
 */
test("RAM ALONE IS BLIND to the cursor step, at every captured state", { skip }, () => {
  const { entries } = captureCorpus();
  const seen = entries.filter((e) => ramOnlyDiff(brokenNoAdvance, e) !== null);
  assert.equal(seen.length, 0, `RAM caught the no-advance twin at ${seen.length} states`);
  console.log(`  BLIND/no-advance: RAM-identical at all ${entries.length} states; only {ix, iy} tell`);
});
