// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_00d8 — memory-equivalent to the frozen oracle at ROM 0x00D8.
 *
 * The entry is ONE INSTRUCTION, `push af`, and then a fall-through into 0x00D9. It has a name of
 * its own because control ARRIVES here rather than at 0x00D9 — three code-shaped arrivals, not one:
 * the NMI vector's `jp` at 0x0066, and a `call nz` at each of 0x00A2 and 0x49D0. "The interrupt
 * lands on the push" is therefore true of the vector only. ⚠ Do NOT extend that into a claim that
 * the two calls leave the epilogue unwinding a frame nobody laid down — that was proposed, measured
 * and WITHDRAWN: a `call` deposits its return in the same slot the vector's PC would, so the stack
 * BALANCES. The name is declined on the one-byte idiom alone.
 *
 * ★ IT IS A TRANSFER, NOT A CALL. The rewrite's last act is `m.call(0x00D9)`, which runs 0x00D9
 *   INCLUDING its `ret` — so the rewrite performs the caller's return itself and must be wired
 *   RAW, exactly as _harness.js documents for the oracle. That is why the WHOLE-MACHINE arm below
 *   passes the candidate unwrapped.
 *
 * ★ THE TWO BYTES IT PUSHES LAND IN WORK RAM, which IS in the state dump, so the routine's whole
 *   product is visible to the ordinary comparison and NOTHING is masked. The SP sweep is what
 *   makes that coverage real rather than incidental: it walks the seat across work RAM, over the
 *   edge into video RAM, and off the bottom into unmapped space.
 *
 * ★ THE RASTER IS NOT PINNED and does not need to be: the oracle's own T-state cost is measured
 *   over the whole corpus by the TIME arm and comes back a single value, so nothing here waits.
 *
 * What it exercises, holes stated:
 *   1. REACH — dispatch counts under both tapes, with the NMI vector's own count as the positive
 *      control that the instrument can see a dispatch at all.
 *   2. SEAM — every captured entry, both sides stopped AT the fall-through, comparing the whole
 *      dump, the device state, the unmapped-access counters, the destination and every register.
 *   3. FULL — the same entries with 0x00D9 really running, so the frame's whole service is shown
 *      equivalent end to end and not merely at the seam.
 *   4. ACCUMULATOR — all 256 accumulator values against four flag words, at the seam.
 *   5. SEAT — the stack seat walked across work RAM and past both its edges, including seats where
 *      the push lands in video RAM and where it falls off the map entirely.
 *   6. TIME — the entry's own T-states, measured over the corpus; one value, which is what lets
 *      the whole-machine arm charge a constant.
 *   7. WHOLE-MACHINE — both tapes, the full frame budget, byte-identical with the rewrite wired
 *      and its measured T-states charged back.
 *   8. EXCLUDED — measured empty, with a control twin that scribbles on an index register.
 *   9. TEETH — six twins, each with its catch counts on the two sweeps.
 *
 * HOLE: the FULL arm runs the frame service from captured entries only. It inherits whatever the
 * tapes visit and nothing else; the crafted sweeps stop at the seam by construction.
 * HOLE: pc and the cycle count are not compared. The frozen path steps both and the rewrite steps
 * neither, which is the ordinary memory-equivalence drop.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-00d8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_00d8 } from "../loc_00d8.js";
import { loc_00d8 as oracle } from "../../translated/loc_00d8.js";
import { buildRoutines } from "../../routines.js";
import { firstStateDiff, wholeMachineEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x00d8;
const CONTINUATION = 0x00d9;
const NMI_VECTOR = 0x0066;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CORPUS_ENTRIES = 150;
const FULL_FORM_LIMIT = 120;
const WHOLE_FRAMES = 1400;

/** Measured by the TIME arm: `push af` and nothing else. */
const OWN_TSTATES = 11;

/**
 * The ceiling on register divergence, and it is EMPTY: the rewrite reaches the same continuation
 * by the same stack operation, so nothing is left standing that the frozen path spends. A ceiling
 * and not a demand — the EXCLUDED arm uses a subset test, so a rewrite cannot be refused for
 * being closer than this.
 */
const MOVED = [];

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

const FLAG_WORDS = [0x00, 0x40, 0xd7, 0xff];
const VALUES = 256;

/** Seats worth walking: inside work RAM, on its lower edge, and off the bottom of the map. */
const SEAT_STRIDE = 64;
const SEAT_FIRST = 0xa800;
const SEAT_LAST = 0xb000;
const EDGE_SEATS = [0xa800, 0xa801, 0xa802, 0xaffe, 0xafff, 0xb000, 0x0000, 0x0002, 0xc000];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** Drop the decoded graphics: nothing here renders, and re-decoding them per clone is the cost. */
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
      if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
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

const firstEntry = () => capture("coin-start", {})[0] ?? null;

// ── the seam ────────────────────────────────────────────────────────────────────────────

/** A routine map that RECORDS the fall-through instead of taking it, and passes everything else. */
function stopAtSeam(real, sink) {
  return {
    get(addr) {
      if (addr !== CONTINUATION) return real.get(addr);
      return (mm) => {
        sink.hits++;
        sink.addr = addr;
        sink.sp = mm.regs.sp;
        sink.regs = Object.fromEntries(REG_FIELDS.map((k) => [k, mm.regs[k]]));
      };
    },
  };
}

/** Everything the state dump does NOT carry, so a device write cannot hide from this gate. */
const deviceSignature = (c) =>
  `${[...c.io.latch].join(",")}|wd=${c.io.watchdogKicks}|snd=${c.io.soundData}` +
  `|ur=${c.mem.unmappedReads}|uw=${c.mem.unmappedWrites}`;

function runToSeam(entry, fn) {
  const c = entry.clone();
  const sink = { hits: 0, addr: null, sp: null, regs: null };
  c.routines = stopAtSeam(entry.routines, sink);
  let threw = null;
  try {
    fn(c);
  } catch (e) {
    threw = String(e).slice(0, 60);
  }
  return { c, sink, threw };
}

/** null when the two agree everywhere this gate compares; otherwise the first disagreement. */
function seamDiff(candidate, entry) {
  const a = runToSeam(entry, oracle);
  const b = runToSeam(entry, candidate);
  if (a.threw !== b.threw) return `threw ${a.threw} vs ${b.threw}`;
  if (a.sink.hits !== b.sink.hits) return `reached the seam ${a.sink.hits} vs ${b.sink.hits} times`;
  if (a.sink.addr !== b.sink.addr) return `went to ${a.sink.addr} vs ${b.sink.addr}`;
  const d = firstStateDiff(a.c.dumpState(), b.c.dumpState(), (o) => a.c.stateOffsetToAddr(o));
  if (d) return `${hex4(d.addr ?? 0)}: frozen=${d.a} rewrite=${d.b}`;
  if (deviceSignature(a.c) !== deviceSignature(b.c)) {
    return `devices ${deviceSignature(a.c)} vs ${deviceSignature(b.c)}`;
  }
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.sink.regs && a.sink.regs[k] !== b.sink.regs[k]) {
      return `${k}=${a.sink.regs[k]} vs ${b.sink.regs[k]} at the seam`;
    }
    if (a.c.regs[k] !== b.c.regs[k]) return `${k}=${a.c.regs[k]} vs ${b.c.regs[k]} after`;
  }
  return null;
}

/** Both sides run the continuation for real, so the frame's whole service is in the comparison. */
function fullDiff(candidate, entry) {
  const run = (fn) => {
    const c = entry.clone();
    try {
      fn(c);
      return { c, threw: null };
    } catch (e) {
      return { c, threw: String(e).slice(0, 60) };
    }
  };
  const a = run(oracle);
  const b = run(candidate);
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

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

function craft(entry, setup) {
  const c = entry.clone();
  setup(c);
  return c;
}

function sweepAccumulator(candidate) {
  const entry = firstEntry();
  let caught = 0;
  for (const f of FLAG_WORDS) {
    for (let v = 0; v < VALUES; v++) {
      const point = craft(entry, (mm) => {
        mm.regs.a = v;
        mm.regs.f = f;
      });
      if (seamDiff(candidate, point) !== null) caught++;
    }
  }
  return caught;
}

const SEATS = [
  ...EDGE_SEATS,
  ...(() => {
    const out = [];
    for (let sp = SEAT_FIRST; sp <= SEAT_LAST; sp += SEAT_STRIDE) out.push(sp);
    return out;
  })(),
];

function sweepSeat(candidate) {
  const entry = firstEntry();
  let caught = 0;
  for (const sp of SEATS) {
    const point = craft(entry, (mm) => {
      mm.regs.sp = sp;
      mm.regs.a = 0x5a;
      mm.regs.f = 0xa5;
    });
    if (seamDiff(candidate, point) !== null) caught++;
  }
  return caught;
}

const SWEEP_RUNS = { accumulator: FLAG_WORDS.length * VALUES, seat: SEATS.length };

// ── the hosted whole-machine replay ─────────────────────────────────────────────────────

/**
 * Wire the rewrite and charge back the T-states the frozen entry spends, so the replay measures
 * the WRITES and not the loss of time. Without it the vblank interrupt lands between different
 * instructions downstream and the address it stacks — which lives in diffed work RAM — moves.
 */
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

/** BUG: takes the fall-through without stacking anything — the tell of an idle gate. */
function brokenNoPush(m) {
  return m.call(CONTINUATION);
}

/** BUG: stacks the wrong pair, so the service restores someone else's accumulator. */
function brokenPushesBc(m) {
  m.push16(m.regs.bc);
  return m.call(CONTINUATION);
}

/** BUG: stacks the pair twice, so the seat ends two bytes low and the service pops rubbish. */
function brokenPushesTwice(m) {
  m.push16(m.regs.af);
  m.push16(m.regs.af);
  return m.call(CONTINUATION);
}

/** BUG: stacks the halves the wrong way round. */
function brokenSwapsHalves(m) {
  const { regs } = m;
  m.push16(((regs.af & 0xff) << 8) | (regs.af >> 8));
  return m.call(CONTINUATION);
}

/** BUG: keeps the flags out of it, which is invisible whenever the flag word happens to be zero. */
function brokenDropsFlags(m) {
  m.push16(m.regs.af & 0xff00);
  return m.call(CONTINUATION);
}

/** BUG: stacks the pair but never hands on, so the frame's work simply does not happen. */
function brokenNeverHandsOn(m) {
  m.push16(m.regs.af);
}

/** BUG: quiets the watchdog on the way past — the control that the device tap can see one. */
function brokenKicksWatchdog(m) {
  m.mem.write8(0xc200, 0, 10);
  return loc_00d8(m);
}

/** BUG: scribbles on an index register — the control for the EXCLUDED ceiling. */
function brokenMovesIndex(m) {
  const r = loc_00d8(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
  return r;
}

const TWINS = [
  ["no-push", brokenNoPush],
  ["pushes-bc", brokenPushesBc],
  ["pushes-twice", brokenPushesTwice],
  ["swaps-halves", brokenSwapsHalves],
  ["drops-flags", brokenDropsFlags],
  ["never-hands-on", brokenNeverHandsOn],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the interrupt really lands here, with the vector as the positive control", { skip }, () => {
  const seen = {};
  for (const [label, opts] of TAPES) {
    const real = buildRoutines();
    const counts = { [TARGET]: 0, [NMI_VECTOR]: 0 };
    const overrides = new Map();
    for (const addr of [TARGET, NMI_VECTOR]) {
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
    // The count below is evidence only because the SAME tap, in the SAME run, also counted the
    // vector. A tap wired to nothing reports zero for a live address just as convincingly.
    assert.ok(seen[label][NMI_VECTOR] > 0, `the ${label} tap counted nothing for the vector either`);
    assert.ok(seen[label][TARGET] > 0, `vacuous: the ${label} tape never reached this entry`);
  }
  const shown = TAPES.map(([l]) => `${l} ${seen[l][TARGET]} (vector ${seen[l][NMI_VECTOR]})`);
  console.log(`  REACH: ${shown.join(", ")}`);
});

test("SEAM: every captured entry agrees at the fall-through", { skip }, () => {
  let total = 0;
  for (const [label, opts] of TAPES) {
    const entries = capture(label, opts);
    assert.notEqual(entries[0] ?? null, null, `vacuous: the ${label} tape never reached the routine`);
    for (const e of entries) assert.equal(seamDiff(loc_00d8, e), null, `${label}: ${seamDiff(loc_00d8, e)}`);
    total += entries.length;
  }
  console.log(`  SEAM: ${total} captured entries identical at the fall-through`);
});

test("FULL: the frame's whole service agrees end to end", { skip }, () => {
  const entries = capture("coin-start", {}).slice(0, FULL_FORM_LIMIT);
  assert.ok(entries.length > 0, "vacuous: nothing was captured to run in full");
  for (const e of entries) assert.equal(fullDiff(loc_00d8, e), null, String(fullDiff(loc_00d8, e)));
  console.log(`  FULL: ${entries.length} entries run through the whole service, identical`);
});

test("ACCUMULATOR: all 256 values against four flag words", { skip }, () => {
  assert.equal(sweepAccumulator(loc_00d8), 0, "an accumulator or flag value diverged");
  console.log(`  ACCUMULATOR: ${SWEEP_RUNS.accumulator} value-and-flag points identical`);
});

test("SEAT: the stack seat walked across work RAM and past both edges", { skip }, () => {
  assert.equal(sweepSeat(loc_00d8), 0, "a stack seat diverged");
  const edge = firstEntry().clone();
  edge.regs.sp = 0xa800;
  edge.regs.af = 0x1234;
  edge.routines = stopAtSeam(edge.routines, { hits: 0 });
  loc_00d8(edge);
  // Proof the walk really leaves work RAM: this seat puts the pair in the tile plane.
  assert.equal(edge.mem.read8(0xa7fe), 0x34, "the low half must land below the seat");
  assert.equal(edge.mem.read8(0xa7ff), 0x12, "the high half must land above the low one");
  console.log(`  SEAT: ${SWEEP_RUNS.seat} seats identical, and the lowest one writes the tile plane`);
});

test("TIME: the entry's own T-states, measured over the corpus", { skip }, () => {
  const costs = new Set();
  for (const e of capture("coin-start", {})) {
    const probe = e.clone();
    const sink = { hits: 0 };
    probe.routines = stopAtSeam(e.routines, sink);
    const before = probe.cycles;
    oracle(probe);
    assert.equal(sink.hits, 1, "the frozen entry did not reach the seam exactly once");
    costs.add(probe.cycles - before);
  }
  console.log(`  TIME: the frozen entry costs ${[...costs].join(", ")} T-states over the corpus`);
  assert.deepEqual([...costs], [OWN_TSTATES], "the entry's own cost is no longer a single value, " +
    "so the constant the whole-machine arm charges back is wrong");
});

test("WHOLE-MACHINE: both tapes are byte-identical with the rewrite wired", { skip }, () => {
  for (const [label, opts] of TAPES) {
    const mk = (ov) => makeMachine(ov, opts);
    const w = wholeMachineEquivalence(mk, WHOLE_FRAMES, new Map([[TARGET, hosted(loc_00d8)]]));
    assert.ok(w.invocations.get(TARGET) > 0, `vacuous: the override never dispatched under ${label}`);
    assert.equal(w.framesCompared, WHOLE_FRAMES, `the ${label} replay ran short`);
    assert.equal(w.equal, true, `${label} forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
    console.log(`  WHOLE-MACHINE/${label}: ${w.framesCompared} frames, ` +
      `${w.invocations.get(TARGET)} dispatches, identical`);
  }
});

/** Which registers a candidate parts company with the frozen entry on, over the corpus. */
function movedOver(candidate) {
  const moved = new Set();
  for (const e of capture("coin-start", {})) {
    const a = runToSeam(e, oracle);
    const b = runToSeam(e, candidate);
    for (const k of REG_FIELDS) if (a.c.regs[k] !== b.c.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED: nothing moves, and the measurement is shown able to see movement", { skip }, () => {
  const moved = movedOver(loc_00d8);
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

test("DEVICES: the device tap is shown able to see a write this entry never makes", { skip }, () => {
  const entry = firstEntry();
  const clean = runToSeam(entry, loc_00d8);
  const control = runToSeam(entry, brokenKicksWatchdog);
  assert.notEqual(deviceSignature(clean.c), deviceSignature(control.c),
    "a twin that quiets the watchdog reads the same as the rewrite, so the device comparison in " +
      "every arm above is decoration");
  assert.equal(deviceSignature(clean.c), deviceSignature(entry.clone()),
    "the rewrite touched a device");
  console.log(`  DEVICES: rewrite ${deviceSignature(clean.c)}; the watchdog twin reads ` +
    `${deviceSignature(control.c)}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const accumulator = sweepAccumulator(twin);
    const seat = sweepSeat(twin);
    const corpus = capture("coin-start", {}).filter((e) => seamDiff(twin, e) !== null).length;
    console.log(`  TEETH/${label}: caught on ${corpus}/${CORPUS_ENTRIES} captured entries, ` +
      `${accumulator}/${SWEEP_RUNS.accumulator} accumulator points, ${seat}/${SWEEP_RUNS.seat} seats`);
    assert.ok(accumulator + seat + corpus > 0, `every arm PASSED the ${label} twin`);
  });
}
