// SPDX-License-Identifier: GPL-3.0-only
/**
 * closeOneTurnOfTheSlotSweep — memory-equivalent to the frozen oracle at ROM 0x410B.
 *
 * GATE: a POKED-natural corpus with an unpoked negative control, plus exhaustive crafted sweeps of
 *   the counter and of both cursors taken against a RECORDER standing in for the pass head, plus a
 *   whole-loop arm that lets the real pass head run, plus teeth.
 *
 * ★ NEITHER TAPE REACHES THIS ADDRESS, AND THAT IS MEASURED RATHER THAN ASSUMED. The sweep it
 *   closes is entered at 0x40D6, which returns at once while (0xAD04) is below 2 — the third era.
 *   Coin-then-start holds the first era for the whole budget, so 0x40D6 is dispatched hundreds of
 *   times and gets past that test never. The REACHABILITY arm counts BOTH addresses under both
 *   tapes, so 0x40D6's own count is the positive control that the tap can see a dispatch at all,
 *   and this address's zero is a finding instead of a hole.
 *
 * ★ SO THE CORPUS IS POKED, AND THE POKE IS THE ERA CELL. Forcing 0xAD04 to 2 from frame 900 puts
 *   the game in the era whose sweep this is, and the game then dispatches the address itself,
 *   hundreds of times, through its own code — no register forced, no entry synthesised. The
 *   NEGATIVE CONTROL arm shows the same run WITHOUT the poke reaching it zero times.
 *
 * ★ THE POKED CORPUS ONLY EVER CARRIES ONE PASS. The count the sweep is started with comes from
 *   0xA8C6, which reads 1 through the whole poked run, so every captured entry takes the arm that
 *   ENDS the sweep and none takes the arm that goes round again. The COUNTER sweep is what covers
 *   the other arm, and the ARMS arm measures the split rather than assuming it.
 *
 * ★ NOTHING IS MASKED: the WINDOW arm measures the oracle's own stack reach over the whole corpus
 *   and pins it at zero, so the whole state dump is compared, the stack included.
 *
 * What it exercises, holes stated:
 *   1. REACHABILITY — zero dispatches under both tapes, with the sweep's entry as the control.
 *   2. NEGATIVE CONTROL — unpoked, the poked-run harness captures nothing.
 *   3. WINDOW — the oracle's push footprint, measured, pinned at zero.
 *   4. CORPUS — every poked-run machine, real pass head running underneath.
 *   5. ARMS — how many corpus entries take each arm, with the loop arm's zero stated.
 *   6. COUNTER — all 256 counter values against the recorder, so both arms are covered.
 *   7. CURSORS — both cursors walked across their own wrap, counter held on the loop arm.
 *   8. SCRATCH-PAIR — the wide pair walked at entry, because the corpus arrives with the stride
 *      already there and so cannot tell a rewrite that writes it from one that inherits it.
 *   9. WHOLE-LOOP — the real pass head, run from crafted counters, so the recorder is corroborated.
 *  10. EXCLUDED — no register outside the declared ceiling moves, with a control twin.
 *  11. TEETH — seven twins with catch counts on all three sweeps.
 *
 * HOLE: the poke puts the game in an era it did not earn. What that costs is any state a real
 * third era would carry that this one does not; the sweeps vary the routine's own inputs on top.
 * HOLE: the whole-loop arm runs only small counters, because a large one drives the real sweep
 * through hundreds of nested passes.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-410b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { closeOneTurnOfTheSlotSweep } from "../closeOneTurnOfTheSlotSweep.js";
import { loc_410b as oracle } from "../../translated/loc_410b.js";
import { loc_40d6 as sweepEntry } from "../../translated/loc_40d6.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { ERA_INDEX } from "../names.js";

const TARGET = 0x410b;
const SWEEP_ENTRY = 0x40d6;
const PASS_HEAD = 0x40ea;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** The era the sweep belongs to, and when the poke starts — both measured, not inherited. */
const ERA_WITH_THIS_SWEEP = 2;
const POKE_FROM_FRAME = 900;

/** The strides, derived here so an edit to the module's constants cannot pass. */
const RECORD_STRIDE = 0x10;
const ENTRY_STRIDE = 2;

const VALUES = 256;
const CORPUS_ENTRIES = 300;
const SMALL_COUNTERS = [1, 2, 3, 5];

/** Measured by the WINDOW arm: this oracle pushes nothing, so nothing is masked. */
const SCRATCH_BYTES = 0;

/**
 * The ceiling on divergence, and the whole of it: the stride addition leaves flags the rewrite's
 * plain arithmetic does not, and on the arm that ends the sweep the oracle takes a return the
 * rewrite omits. A CEILING, not a demand — a rewrite that diverged on fewer still passes.
 */
const MOVED = ["f", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured machines ───────────────────────────────────────────────────────────────

/** Count dispatches of both addresses under one tape, with or without the era poke. */
function dispatchCounts(opts, poked) {
  const seen = { [TARGET]: 0, [SWEEP_ENTRY]: 0 };
  const overrides = new Map();
  overrides.set(TARGET, (mm) => {
    seen[TARGET]++;
    return oracle(mm);
  });
  overrides.set(SWEEP_ENTRY, (mm) => {
    seen[SWEEP_ENTRY]++;
    return sweepEntry(mm);
  });
  const m = makeMachine(overrides, opts);
  if (poked) m.pokes = [{ addr: ERA_INDEX, val: ERA_WITH_THIS_SWEEP, frame: POKE_FROM_FRAME, dur: null }];
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `run stopped early: ${m.stoppedBy}`);
  return seen;
}

let captured = null;

/** Machines taken at this address's own dispatches, in the poked era run. */
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
    return oracle(mm);
  }]]));
  m.pokes = [{ addr: ERA_INDEX, val: ERA_WITH_THIS_SWEEP, frame: POKE_FROM_FRAME, dur: null }];
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

// ── comparison ──────────────────────────────────────────────────────────────────────────

/** A routine map whose pass head records what it was handed and returns instead of sweeping. */
function recorderRoutines(seen) {
  const map = buildRoutines();
  map.set(PASS_HEAD, (mm) => {
    seen.push({ b: mm.regs.b, ix: mm.regs.ix, iy: mm.regs.iy, de: mm.regs.de });
    mm.ret();
  });
  return map;
}

function registerDiff(a, b) {
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

/** Oracle vs candidate on independent clones, real pass head: the whole dump plus the registers. */
function unitDiff(candidate, machine, setup) {
  const a = machine.clone();
  const b = machine.clone();
  if (setup) {
    setup(a);
    setup(b);
  }
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 60) };
  }
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off))
    ?? registerDiff(a, b);
}

/** The same comparison with the pass head replaced by a recorder, so the STEP is what is compared. */
function stagedDiff(candidate, machine, setup) {
  const seenA = [];
  const seenB = [];
  const a = machine.clone();
  const b = machine.clone();
  a.routines = recorderRoutines(seenA);
  b.routines = recorderRoutines(seenB);
  setup(a);
  setup(b);
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 60) };
  }
  if (JSON.stringify(seenA) !== JSON.stringify(seenB)) {
    return { addr: null, a: JSON.stringify(seenA), b: JSON.stringify(seenB) };
  }
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off))
    ?? registerDiff(a, b);
}

function oracleDepth(machine) {
  const c = machine.clone();
  const seen = [];
  c.routines = recorderRoutines(seen);
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

/** Every counter value, which is what puts both arms under the comparison. */
function sweepCounter(candidate) {
  const base = capture()[0];
  let caught = 0;
  for (let value = 0; value < VALUES; value++) {
    if (stagedDiff(candidate, base, (mm) => { mm.regs.b = value; })) caught++;
  }
  return caught;
}

/** Both cursors walked across their own wrap, on the arm that goes round again. */
const CURSOR_SEEDS = [0x0000, 0x0001, 0x7fff, 0xa8c0, 0xfff0, 0xfffe, 0xffff];

function sweepCursors(candidate) {
  let caught = 0;
  const base = capture()[0];
  for (const ix of CURSOR_SEEDS) {
    for (const iy of CURSOR_SEEDS) {
      const d = stagedDiff(candidate, base, (mm) => {
        mm.regs.b = 4;
        mm.regs.ix = ix;
        mm.regs.iy = iy;
      });
      if (d) caught++;
    }
  }
  return caught;
}

/**
 * The wide scratch pair, walked at entry. THIS ARM EXISTS BECAUSE THE CORPUS CANNOT SEE THE PAIR:
 * every captured entry already holds the stride there — the sweep's own back edge put it there on
 * the previous pass — so a rewrite that never wrote it would read clean over the whole corpus. The
 * SCRATCH-PAIR twin below is the control that this arm, and only this arm, catches that.
 */
const SCRATCH_SEEDS = [0x0000, 0x0010, 0x0011, 0x1234, 0x00ff, 0xff00, 0xffff];

function sweepScratchPair(candidate) {
  let caught = 0;
  const base = capture()[0];
  for (const de of SCRATCH_SEEDS) {
    for (const counter of [1, 4]) {
      const d = stagedDiff(candidate, base, (mm) => {
        mm.regs.de = de;
        mm.regs.b = counter;
      });
      if (d) caught++;
    }
  }
  return caught;
}

const SWEEP_RUNS = {
  counter: VALUES,
  cursors: CURSOR_SEEDS.length ** 2,
  scratch: SCRATCH_SEEDS.length * 2,
};

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: gives each cursor the other's stride, so the pair stops addressing one slot. */
function brokenStridesSwapped(m) {
  const { regs } = m;
  regs.de = RECORD_STRIDE;
  regs.ix = (regs.ix + ENTRY_STRIDE) & 0xffff;
  regs.iy = (regs.iy + RECORD_STRIDE) & 0xffff;
  regs.b = (regs.b - 1) & 0xff;
  if (regs.b !== 0) return m.call(PASS_HEAD);
}

/** BUG: steps the record cursor and leaves the entry cursor where it was. */
function brokenEntryCursorStuck(m) {
  const { regs } = m;
  regs.de = RECORD_STRIDE;
  regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
  regs.b = (regs.b - 1) & 0xff;
  if (regs.b !== 0) return m.call(PASS_HEAD);
}

/** BUG: steps the entry cursor once instead of twice, halving its stride. */
function brokenHalfEntryStride(m) {
  const { regs } = m;
  regs.de = RECORD_STRIDE;
  regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
  regs.iy = (regs.iy + 1) & 0xffff;
  regs.b = (regs.b - 1) & 0xff;
  if (regs.b !== 0) return m.call(PASS_HEAD);
}

/** BUG: reads the counter's zero BEFORE stepping it, so the sweep runs one pass short. */
function brokenTestsBeforeStepping(m) {
  const { regs } = m;
  regs.de = RECORD_STRIDE;
  regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
  regs.iy = (regs.iy + ENTRY_STRIDE) & 0xffff;
  const wasLast = regs.b === 0;
  regs.b = (regs.b - 1) & 0xff;
  if (!wasLast) return m.call(PASS_HEAD);
}

/** BUG: leaves the stride out of the wide scratch pair, which the pass head can read. */
function brokenStrideNotLeft(m) {
  const { regs } = m;
  regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
  regs.iy = (regs.iy + ENTRY_STRIDE) & 0xffff;
  regs.b = (regs.b - 1) & 0xff;
  if (regs.b !== 0) return m.call(PASS_HEAD);
}

/** BUG: never steps the counter, so nothing ever ends the sweep. */
function brokenCounterNotStepped(m) {
  const { regs } = m;
  regs.de = RECORD_STRIDE;
  regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
  regs.iy = (regs.iy + ENTRY_STRIDE) & 0xffff;
  return m.call(PASS_HEAD);
}

/** BUG: scribbles on a register outside the ceiling — the control for the EXCLUDED arm. */
function brokenMovesHl(m) {
  closeOneTurnOfTheSlotSweep(m);
  m.regs.hl = (m.regs.hl + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["strides-swapped", brokenStridesSwapped],
  ["entry-cursor-stuck", brokenEntryCursorStuck],
  ["half-entry-stride", brokenHalfEntryStride],
  ["tests-before-stepping", brokenTestsBeforeStepping],
  ["stride-not-left", brokenStrideNotLeft],
  ["counter-not-stepped", brokenCounterNotStepped],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHABILITY: neither tape reaches this address, with a positive control", { skip }, () => {
  const driven = dispatchCounts({}, false);
  const idle = dispatchCounts({ tape: [] }, false);
  // The zeros are evidence ONLY because the same tap, in the same runs, counted the sweep's own
  // entry. A broken tap and a genuinely unreached address look identical without that.
  assert.ok(driven[SWEEP_ENTRY] > 0 && idle[SWEEP_ENTRY] > 0,
    "the tap counted nothing for the sweep's ENTRY either, so it is broken and the zeros below " +
      "mean nothing");
  assert.equal(driven[TARGET] + idle[TARGET], 0,
    "the tapes now reach this address, so the poked corpus below is no longer the best evidence " +
      "available and this gate should capture unpoked entries");
  console.log(`  REACHABILITY: ${hex4(TARGET)} entered ${driven[TARGET]} times driven and ` +
    `${idle[TARGET]} idle; the control ${hex4(SWEEP_ENTRY)} entered ` +
    `${driven[SWEEP_ENTRY]} and ${idle[SWEEP_ENTRY]}`);
});

test("NEGATIVE CONTROL: the poke is what makes the corpus exist", { skip }, () => {
  const poked = dispatchCounts({}, true);
  const unpoked = dispatchCounts({}, false);
  assert.equal(unpoked[TARGET], 0, "the unpoked run reaches it, so the poke is not load-bearing");
  assert.ok(poked[TARGET] > 0, "the poked run does NOT reach it, so every arm below is vacuous");
  console.log(`  NEGATIVE CONTROL: poked ${poked[TARGET]} dispatches, unpoked ${unpoked[TARGET]}`);
});

test("WINDOW: the oracle pushes nothing, measured over the corpus", { skip }, () => {
  let deepest = 0;
  for (const e of capture()) deepest = Math.max(deepest, oracleDepth(e));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat, so the ` +
    "whole dump is compared with nothing masked");
  assert.equal(deepest, SCRATCH_BYTES, "the oracle now pushes, so a masked window is owed and " +
    "every arm here is comparing bytes it has no right to");
});

test("CORPUS: every poked-run machine replays identically", { skip }, () => {
  const entries = capture();
  assert.notEqual(entries[0] ?? null, null, "vacuous: the poked tape never reached the routine");
  for (const e of entries) {
    const d = unitDiff(closeOneTurnOfTheSlotSweep, e);
    assert.equal(d, null, show(d));
  }
  console.log(`  CORPUS: ${entries.length} captured machines identical, with the real pass head ` +
    "running underneath");
});

test("ARMS: which arm the corpus takes, and which it never does", { skip }, () => {
  const tally = { ends: 0, loops: 0 };
  for (const e of capture()) (e.regs.b === 1 ? tally.ends++ : tally.loops++);
  console.log(`  ARMS: ${tally.ends} entries end the sweep, ${tally.loops} go round again`);
  assert.ok(tally.ends > 0, "the arm counter found neither arm, so it is broken and the zero it " +
    "reports for the other means nothing");
  assert.equal(tally.loops, 0, "the corpus now carries a multi-pass sweep, so the crafted counter " +
    "sweep is no longer the only cover for that arm and this gate should say so");
});

test("COUNTER: all 256 counter values, both arms", { skip }, () => {
  assert.equal(sweepCounter(closeOneTurnOfTheSlotSweep), 0, "a counter value diverged");
  const seen = [];
  const probe = capture()[0].clone();
  probe.routines = recorderRoutines(seen);
  probe.regs.b = 0;
  closeOneTurnOfTheSlotSweep(probe);
  assert.equal(seen.length, 1, "a counter of zero must go round again, not end the sweep");
  assert.equal(seen[0].b, 0xff, "a counter of zero must come down to 255 inside a byte");
  console.log(`  COUNTER: ${SWEEP_RUNS.counter} values identical, zero coming down to 255`);
});

test("CURSORS: both cursors across their own wrap", { skip }, () => {
  assert.equal(sweepCursors(closeOneTurnOfTheSlotSweep), 0, "a cursor seed diverged");
  const seen = [];
  const probe = capture()[0].clone();
  probe.routines = recorderRoutines(seen);
  probe.regs.b = 4;
  probe.regs.ix = 0xfff8;
  probe.regs.iy = 0xffff;
  closeOneTurnOfTheSlotSweep(probe);
  assert.equal(seen[0].ix, 0x0008, "the record cursor must wrap in sixteen bits");
  assert.equal(seen[0].iy, 0x0001, "the entry cursor must wrap in sixteen bits");
  console.log(`  CURSORS: ${SWEEP_RUNS.cursors} seed pairs identical, both wraps included`);
});

test("SCRATCH-PAIR: the stride is written, not inherited", { skip }, () => {
  assert.equal(sweepScratchPair(closeOneTurnOfTheSlotSweep), 0, "a scratch-pair seed diverged");
  const inherited = new Set(capture().map((e) => e.regs.de));
  assert.deepEqual([...inherited], [RECORD_STRIDE], "the corpus no longer arrives with the stride " +
    "already in the pair, so the reason this arm exists has changed and should be re-stated");
  console.log(`  SCRATCH-PAIR: ${SWEEP_RUNS.scratch} seeds identical; every captured entry ` +
    `already held ${hex4(RECORD_STRIDE)} there, which is why the corpus cannot cover this`);
});

test("WHOLE-LOOP: the real pass head, from crafted counters", { skip }, () => {
  const entries = capture().slice(0, 40);
  for (const counter of SMALL_COUNTERS) {
    for (const e of entries) {
      const d = unitDiff(closeOneTurnOfTheSlotSweep, e, (mm) => { mm.regs.b = counter; });
      assert.equal(d, null, `counter=${counter}: ${show(d)}`);
    }
  }
  console.log(`  WHOLE-LOOP: ${entries.length} machines at counters ${SMALL_COUNTERS.join(", ")} ` +
    "identical, with the real pass head sweeping underneath");
});

function movedOver(candidate) {
  const moved = new Set();
  for (const e of capture()) {
    const a = e.clone();
    const b = e.clone();
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
  const moved = movedOver(closeOneTurnOfTheSlotSweep);
  const control = movedOver(brokenMovesHl);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on a " +
      "register pair, so a clean reading below proves nothing");
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
    const counter = sweepCounter(twin);
    const cursors = sweepCursors(twin);
    const scratch = sweepScratchPair(twin);
    console.log(`  TEETH/${label}: caught on ${counter}/${SWEEP_RUNS.counter} counters, ` +
      `${cursors}/${SWEEP_RUNS.cursors} cursor pairs, ${scratch}/${SWEEP_RUNS.scratch} pair seeds`);
    assert.ok(counter + cursors + scratch > 0, `every sweep PASSED the ${label} twin`);
  });
}
