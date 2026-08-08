// SPDX-License-Identifier: GPL-3.0-only
/**
 * parkTheImageTotalForTheTamperVerdict — memory-equivalent to the frozen oracle at ROM 0x07AD.
 *
 * Four bytes: `ld b,a` and a jump to 0x5303. It sits in the middle of the tamper chain — a fold
 * over a block of the image arrives with the total in A, this entry parks that total in B, and
 * 0x5303 calls a helper whose last act hands the same byte back before comparing it against a
 * baked-in constant and branching to the trap on a mismatch.
 *
 * ★ IT IS A TRANSFER, NOT A CALL, so the rewrite's `m.call(0x5303)` performs the caller's return
 *   itself and the candidate is wired RAW in the whole-machine arm, as _harness.js sets out.
 *
 * ★ ONE DISPATCH A SESSION. This entry fires exactly once under each tape — the tamper check runs
 *   at boot and never again — so a corpus arm alone would rest on a single point. The two crafted
 *   sweeps are where the coverage actually is, and the VERDICT arm shows they are not all the same
 *   point in disguise: the swept total drives the chain down BOTH sides of the comparison, and the
 *   counts of each are asserted rather than hoped for.
 *
 * ★ NOTHING IS MASKED. The frozen entry pushes nothing of its own and writes nothing, which the
 *   FOOTPRINT arm measures rather than assumes, so the whole state dump is compared, stack
 *   included, and the device state and the unmapped-access counters with it.
 *
 * What it exercises, holes stated:
 *   1. REACH — dispatch counts under both tapes, with the folding routine that jumps here as the
 *      positive control that the instrument can see a dispatch.
 *   2. SEAM — the captured entry, both sides stopped AT the jump: the whole dump, the devices, the
 *      counters, the destination and every register.
 *   3. FULL — the same entry with the verdict arm really running, end to end.
 *   4. TOTAL — all 256 totals, at the seam AND in full, so the comparison downstream is exercised
 *      on both of its answers.
 *   5. VERDICT — how many of those 256 reach the trap and how many the clean arm, measured, so the
 *      sweep is shown to discriminate instead of merely being large.
 *   6. PASSENGER — the other registers walked at the seam, including the one this entry
 *      overwrites, so a rewrite that reads the wrong source is caught by value and not by luck.
 *   7. FOOTPRINT — the frozen entry's deepest push and its device writes, measured and pinned at
 *      nothing, which is what licenses comparing the raw dump.
 *   8. TIME — the entry's own T-states, measured; one value, which the whole-machine arm charges.
 *   9. WHOLE-MACHINE — both tapes, the full frame budget, byte-identical with the rewrite wired.
 *  10. EXCLUDED — measured empty, with a control twin that scribbles on an index register.
 *  11. TEETH — six twins with their catch counts on both sweeps.
 *
 * HOLE: every crafted point is the one captured entry with registers set by hand. Work RAM is
 * whatever that entry held, and no sweep varies it — this entry reads no memory, but that is a
 * claim about the four bytes and not something these arms measure.
 * HOLE: pc and the cycle count are not compared, the ordinary memory-equivalence drop.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-07ad.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { parkTheImageTotalForTheTamperVerdict } from "../parkTheImageTotalForTheTamperVerdict.js";
import { loc_07ad as oracle } from "../../translated/loc_07ad.js";
import { buildRoutines } from "../../routines.js";
import { firstStateDiff, wholeMachineEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x07ad;
const CONTINUATION = 0x5303;
/** The fold that jumps here with the total in A; the positive control for the REACH arm. */
const FOLDER = 0x43e8;
/** The two ends of the comparison 0x5303 makes: the tamper trap and the clean continuation. */
const TRAP_ARM = 0x0f8d;
const CLEAN_ARM = 0x0f1a;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const WHOLE_FRAMES = 1400;
const VALUES = 256;

/** Measured by the TIME arm: `ld b,a` and the jump. */
const OWN_TSTATES = 14;
/** Measured by the FOOTPRINT arm: the frozen entry pushes nothing, so nothing is masked. */
const SCRATCH_BYTES = 0;

/**
 * The ceiling on register divergence, and it is EMPTY: the rewrite makes the same one register
 * move the frozen entry makes and leaves every other alone, flags included. A ceiling, not a
 * demand — the EXCLUDED arm tests a subset, so a closer rewrite still passes.
 */
const MOVED = [];

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

/** Registers the entry carries past untouched; each is walked over these values at the seam. */
const PASSENGERS = ["a", "b", "c", "d", "e", "h", "l", "f"];
const PASSENGER_VALUES = [0x00, 0x01, 0x55, 0x67, 0x80, 0xaa, 0xff];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── capture ─────────────────────────────────────────────────────────────────────────────

const captured = new Map();

function capture(label, opts) {
  if (captured.has(label)) return captured.get(label);
  const real = buildRoutines();
  const body = real.get(TARGET);
  const entries = [];
  const m = makeMachine(
    new Map([[TARGET, (mm, ...args) => {
      entries.push(lean(mm.clone()));
      return body(mm, ...args);
    }]]),
    opts,
  );
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the ${label} capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, `the ${label} capture run ran short`);
  captured.set(label, entries);
  return entries;
}

const theEntry = () => capture("coin-start", {})[0] ?? null;

// ── the seam ────────────────────────────────────────────────────────────────────────────

function stopAtSeam(real, sink) {
  return {
    get(addr) {
      if (addr !== CONTINUATION) return real.get(addr);
      return (mm) => {
        sink.hits++;
        sink.addr = addr;
        sink.regs = Object.fromEntries(REG_FIELDS.map((k) => [k, mm.regs[k]]));
      };
    },
  };
}

const deviceSignature = (c) =>
  `${[...c.io.latch].join(",")}|wd=${c.io.watchdogKicks}|snd=${c.io.soundData}` +
  `|ur=${c.mem.unmappedReads}|uw=${c.mem.unmappedWrites}`;

function runToSeam(entry, fn) {
  const c = entry.clone();
  const sink = { hits: 0, addr: null, regs: null };
  c.routines = stopAtSeam(entry.routines, sink);
  let threw = null;
  try {
    fn(c);
  } catch (e) {
    threw = String(e).slice(0, 60);
  }
  return { c, sink, threw };
}

function compare(a, b) {
  if (a.threw !== b.threw) return `threw ${a.threw} vs ${b.threw}`;
  const d = firstStateDiff(a.c.dumpState(), b.c.dumpState(), (o) => a.c.stateOffsetToAddr(o));
  if (d) return `${hex4(d.addr ?? 0)}: frozen=${d.a} rewrite=${d.b}`;
  if (deviceSignature(a.c) !== deviceSignature(b.c)) {
    return `devices ${deviceSignature(a.c)} vs ${deviceSignature(b.c)}`;
  }
  for (const k of REG_FIELDS) {
    if (!MOVED.includes(k) && a.c.regs[k] !== b.c.regs[k]) {
      return `${k}=${a.c.regs[k]} vs ${b.c.regs[k]}`;
    }
  }
  return null;
}

function seamDiff(candidate, entry) {
  const a = runToSeam(entry, oracle);
  const b = runToSeam(entry, candidate);
  if (a.sink.hits !== b.sink.hits) return `reached the jump ${a.sink.hits} vs ${b.sink.hits} times`;
  if (a.sink.addr !== b.sink.addr) return `jumped to ${a.sink.addr} vs ${b.sink.addr}`;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.sink.regs && a.sink.regs[k] !== b.sink.regs[k]) {
      return `${k}=${a.sink.regs[k]} vs ${b.sink.regs[k]} at the jump`;
    }
  }
  return compare(a, b);
}

function runFull(entry, fn) {
  const c = entry.clone();
  try {
    fn(c);
    return { c, threw: null, sink: { hits: 1, addr: CONTINUATION, regs: null } };
  } catch (e) {
    return { c, threw: String(e).slice(0, 60), sink: { hits: 1, addr: CONTINUATION, regs: null } };
  }
}

const fullDiff = (candidate, entry) => compare(runFull(entry, oracle), runFull(entry, candidate));

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

function craft(setup) {
  const c = theEntry().clone();
  setup(c);
  return c;
}

function sweepTotals(candidate, diff) {
  let caught = 0;
  for (let v = 0; v < VALUES; v++) {
    if (diff(candidate, craft((mm) => { mm.regs.a = v; })) !== null) caught++;
  }
  return caught;
}

function sweepPassengers(candidate) {
  let caught = 0;
  for (const k of PASSENGERS) {
    for (const v of PASSENGER_VALUES) {
      const point = craft((mm) => { mm.regs[k] = v; });
      if (seamDiff(candidate, point) !== null) caught++;
    }
  }
  return caught;
}

const SWEEP_RUNS = {
  totalsSeam: VALUES,
  totalsFull: VALUES,
  passengers: PASSENGERS.length * PASSENGER_VALUES.length,
};

/** Which end of the comparison each swept total drives the chain into, counted. */
function verdictCounts(fn) {
  const counts = { [TRAP_ARM]: 0, [CLEAN_ARM]: 0 };
  for (let v = 0; v < VALUES; v++) {
    const c = craft((mm) => { mm.regs.a = v; });
    const real = c.routines;
    c.routines = {
      get: (addr) =>
        addr === TRAP_ARM || addr === CLEAN_ARM
          ? (mm) => {
              counts[addr]++;
              return real.get(addr)(mm);
            }
          : real.get(addr),
    };
    fn(c);
  }
  return counts;
}

// ── the hosted whole-machine replay ─────────────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const real = mm.routines;
    mm.routines = {
      get: (addr) =>
        addr === CONTINUATION
          ? (x) => {
              x.routines = real;
              x.step(CONTINUATION, OWN_TSTATES);
              return x.call(CONTINUATION);
            }
          : real.get(addr),
    };
    try {
      return candidate(mm);
    } finally {
      mm.routines = real;
    }
  };
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: hands on without parking the total, so the verdict is made on a stale register. */
function brokenNoCopy(m) {
  return m.call(CONTINUATION);
}

/** BUG: parks the wrong register. */
function brokenCopiesC(m) {
  m.regs.b = m.regs.c;
  return m.call(CONTINUATION);
}

/** BUG: copies the wrong way round, losing the total instead of duplicating it. */
function brokenCopiesBackwards(m) {
  m.regs.a = m.regs.b;
  return m.call(CONTINUATION);
}

/** BUG: clears the total after parking it; the helper puts it back, so only the flags tell. */
function brokenClearsTotal(m) {
  m.regs.b = m.regs.a;
  m.regs.a = 0;
  return m.call(CONTINUATION);
}

/** BUG: sets flags the frozen entry leaves standing — a plain register move raises none. */
function brokenSetsFlags(m) {
  m.regs.b = m.regs.a;
  m.regs.and(m.regs.a);
  return m.call(CONTINUATION);
}

/** BUG: parks the total and stops, so the verdict is never reached. */
function brokenNeverHandsOn(m) {
  m.regs.b = m.regs.a;
}

/** BUG: scribbles on an index register — the control for the EXCLUDED ceiling. */
function brokenMovesIndex(m) {
  m.regs.b = m.regs.a;
  m.regs.iy = (m.regs.iy + 1) & 0xffff;
  return m.call(CONTINUATION);
}

const TWINS = [
  ["no-copy", brokenNoCopy],
  ["copies-c", brokenCopiesC],
  ["copies-backwards", brokenCopiesBackwards],
  ["clears-total", brokenClearsTotal],
  ["sets-flags", brokenSetsFlags],
  ["never-hands-on", brokenNeverHandsOn],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the tamper chain really passes through here, with a positive control", { skip }, () => {
  const seen = {};
  for (const [label, opts] of TAPES) {
    const real = buildRoutines();
    const counts = { [TARGET]: 0, [FOLDER]: 0 };
    const overrides = new Map();
    for (const addr of [TARGET, FOLDER]) {
      const body = real.get(addr);
      overrides.set(addr, (mm, ...args) => {
        counts[addr]++;
        return body(mm, ...args);
      });
    }
    const m = makeMachine(overrides, opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} reach run stopped early: ${m.stoppedBy}`);
    seen[label] = counts;
  }
  for (const [label] of TAPES) {
    assert.ok(seen[label][FOLDER] > 0, `the ${label} tap counted nothing for the fold either, so ` +
      "the instrument is broken and the count below means nothing");
    assert.ok(seen[label][TARGET] > 0, `vacuous: the ${label} tape never reached this entry`);
  }
  console.log(`  REACH: ${TAPES.map(([l]) => `${l} ${seen[l][TARGET]} (fold ${seen[l][FOLDER]})`).join(", ")}`);
});

test("SEAM: the captured entry agrees at the jump", { skip }, () => {
  for (const [label, opts] of TAPES) {
    const entries = capture(label, opts);
    assert.notEqual(entries[0] ?? null, null, `vacuous: the ${label} tape never reached the routine`);
    for (const e of entries) {
      const d = seamDiff(parkTheImageTotalForTheTamperVerdict, e);
      assert.equal(d, null, `${label}: ${d}`);
    }
  }
  const shown = TAPES.map(([l]) => `${l} ${capture(l, {}).length}`);
  console.log(`  SEAM: identical at the jump on every captured entry (${shown.join(", ")})`);
});

test("FULL: the verdict arm runs and agrees end to end", { skip }, () => {
  const d = fullDiff(parkTheImageTotalForTheTamperVerdict, theEntry());
  assert.equal(d, null, String(d));
  console.log("  FULL: the captured entry run through the verdict is identical");
});

test("TOTAL: all 256 totals, at the jump and in full", { skip }, () => {
  assert.equal(sweepTotals(parkTheImageTotalForTheTamperVerdict, seamDiff), 0, "a total diverged at the jump");
  assert.equal(sweepTotals(parkTheImageTotalForTheTamperVerdict, fullDiff), 0, "a total diverged end to end");
  console.log(`  TOTAL: ${SWEEP_RUNS.totalsSeam} at the jump and ${SWEEP_RUNS.totalsFull} in full, identical`);
});

test("VERDICT: the sweep drives both ends of the comparison, counted", { skip }, () => {
  const counts = verdictCounts(oracle);
  console.log(`  VERDICT: of ${VALUES} totals, ${counts[TRAP_ARM]} reach the trap and ` +
    `${counts[CLEAN_ARM]} the clean arm`);
  assert.ok(counts[TRAP_ARM] > 0, "no swept total reaches the trap, so the full sweep exercises " +
    "only one side of the comparison and is not the coverage this gate claims");
  assert.ok(counts[CLEAN_ARM] > 0, "no swept total reaches the clean arm, so the sweep never " +
    "shows the chain doing what a genuine image makes it do");
  assert.equal(counts[TRAP_ARM] + counts[CLEAN_ARM], VALUES, "some total reached neither end");
});

test("PASSENGER: the registers carried past are walked by value", { skip }, () => {
  assert.equal(sweepPassengers(parkTheImageTotalForTheTamperVerdict), 0, "a passenger register diverged");
  console.log(`  PASSENGER: ${SWEEP_RUNS.passengers} register-and-value points identical`);
});

test("FOOTPRINT: the frozen entry pushes nothing and writes no device", { skip }, () => {
  let deepest = 0;
  for (let v = 0; v < VALUES; v++) {
    const c = craft((mm) => { mm.regs.a = v; });
    const sink = { hits: 0 };
    c.routines = stopAtSeam(c.routines, sink);
    const seat = c.regs.sp;
    const push = c.push16.bind(c);
    let low = seat;
    c.push16 = (value) => {
      const r = push(value);
      if (c.regs.sp < low) low = c.regs.sp;
      return r;
    };
    const before = deviceSignature(c);
    oracle(c);
    assert.equal(deviceSignature(c), before, `the frozen entry touched a device on total ${v}`);
    deepest = Math.max(deepest, seat - low);
  }
  console.log(`  FOOTPRINT (measured): the frozen entry reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the frozen entry now pushes, so a masked window is owed " +
    "and every arm here is comparing bytes it has no right to");
});

test("TIME: the entry's own T-states, measured", { skip }, () => {
  const costs = new Set();
  for (let v = 0; v < VALUES; v++) {
    const c = craft((mm) => { mm.regs.a = v; });
    const sink = { hits: 0 };
    c.routines = stopAtSeam(c.routines, sink);
    const before = c.cycles;
    oracle(c);
    assert.equal(sink.hits, 1, "the frozen entry did not reach the jump exactly once");
    costs.add(c.cycles - before);
  }
  console.log(`  TIME: the frozen entry costs ${[...costs].join(", ")} T-states`);
  assert.deepEqual([...costs], [OWN_TSTATES], "the entry's own cost is no longer a single value, " +
    "so the constant the whole-machine arm charges back is wrong");
});

test("WHOLE-MACHINE: both tapes are byte-identical with the rewrite wired", { skip }, () => {
  for (const [label, opts] of TAPES) {
    const mk = (ov) => makeMachine(ov, opts);
    const w = wholeMachineEquivalence(mk, WHOLE_FRAMES, new Map([[TARGET, hosted(parkTheImageTotalForTheTamperVerdict)]]));
    assert.ok(w.invocations.get(TARGET) > 0, `vacuous: the override never dispatched under ${label}`);
    assert.equal(w.framesCompared, WHOLE_FRAMES, `the ${label} replay ran short`);
    assert.equal(w.equal, true, `${label} forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
    console.log(`  WHOLE-MACHINE/${label}: ${w.framesCompared} frames, ` +
      `${w.invocations.get(TARGET)} dispatch, identical`);
  }
});

function movedOver(candidate) {
  const moved = new Set();
  for (let v = 0; v < VALUES; v++) {
    const point = craft((mm) => { mm.regs.a = v; });
    const a = runToSeam(point, oracle);
    const b = runToSeam(point, candidate);
    for (const k of REG_FIELDS) if (a.c.regs[k] !== b.c.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED: nothing moves, and the measurement is shown able to see movement", { skip }, () => {
  const moved = movedOver(parkTheImageTotalForTheTamperVerdict);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the control twin scribbles on an index register and this measurement did not notice, so a " +
      "clean reading below is worth nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ") || "none"}` +
    ` — ceiling ${MOVED.join(", ") || "empty"}; the control also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const atSeam = sweepTotals(twin, seamDiff);
    const inFull = sweepTotals(twin, fullDiff);
    const passengers = sweepPassengers(twin);
    console.log(`  TEETH/${label}: caught on ${atSeam}/${SWEEP_RUNS.totalsSeam} totals at the jump, ` +
      `${inFull}/${SWEEP_RUNS.totalsFull} in full, ${passengers}/${SWEEP_RUNS.passengers} passengers`);
    assert.ok(atSeam + inFull + passengers > 0, `every arm PASSED the ${label} twin`);
  });
}
