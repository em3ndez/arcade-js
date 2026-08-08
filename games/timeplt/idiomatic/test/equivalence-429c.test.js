// SPDX-License-Identifier: GPL-3.0-only
/**
 * setTheLaunchFacingInsideOneAimWindow — memory-equivalent to the frozen oracle at ROM 0x429C.
 *
 * GATE: the whole captured corpus replayed with the REAL launcher at 0x42B7 running underneath,
 *   plus exhaustive crafted sweeps of all three bytes this routine reads, taken against a RECORDER
 *   standing in for that launcher, plus an arm that pins the window's two edges, plus teeth.
 *
 * ★ ONE TAPE REACHES IT AND THE OTHER DOES NOT, AND BOTH ARE MEASURED. 0x4243 reaches this address
 *   with `jp z,0x429C` while the era cell 0xAD04 reads zero. Coin-then-start dispatches it; the
 *   undriven attract tape never dispatches 0x4243 at all, so it cannot. The REACH arm counts BOTH
 *   addresses under BOTH tapes, so the attract zero comes with the control that says why.
 *
 * ★ THE CORPUS IS SMALL — single digits — WHICH IS WHY THE SWEEPS DO THE WORK. Everything this
 *   routine reads is three bytes: the window's half-width at 0xA8E6 and the two coordinates the
 *   sprite entry carries at (IY+0x00) and (IY+0x31). All three are walked over every value they
 *   can hold, against a recorder, so the input space is covered even though the corpus is not big.
 *
 * ★ THE WINDOW TEST WRAPS, AND THE WRAP IS THE POINT. Both the re-centring and the doubling happen
 *   in a byte, so the window is not "within the half-width of the line" once the half-width is
 *   large: it is the DOUBLED half-width's worth of places ENDING at line-plus-half-width, taken
 *   round the byte. Below 0x80 that comes out symmetric about the line; at exactly 0x00 or 0x80 the
 *   doubling gives zero and the window shuts over every coordinate; above 0x80 it reopens narrower
 *   and no longer centred on the line at all. The SHAPE arm pins that as a set, built the other
 *   way round from the subtract-and-compare the routine uses, so it can disagree.
 *
 * ★ NOTHING IS MASKED: the WINDOW-STACK arm measures the oracle's own stack reach over the corpus
 *   and pins it at zero, so the whole state dump is compared, the stack included.
 *
 * What it exercises, holes stated:
 *   1. REACH — dispatch counts for this address and its dispatcher, under both tapes.
 *   2. WINDOW-STACK — the oracle's push footprint, measured, pinned at zero.
 *   3. CORPUS — every captured machine, real launcher running underneath.
 *   4. ARMS — how many corpus entries take each of the three arms, all three asserted seen.
 *   5. HALF-WIDTH — all 256 half-widths against the recorder.
 *   6. COORDINATE — all 256 values of the gating coordinate, at six half-widths.
 *   7. FACING — all 256 values of the other coordinate, window held open.
 *   8. SHAPE — which coordinates the window admits, pinned against a set built the other way round.
 *   9. FACING LINE — where the split between the two facings falls, pinned by value.
 *  10. EXCLUDED — no register outside the declared ceiling moves, with a control twin.
 *  11. TEETH — seven twins with catch counts on all three sweeps.
 *
 * HOLE: the sweeps vary those three bytes and nothing else; the rest of each machine is whatever
 * the captured entry happened to hold, and only one captured entry seeds the sweeps.
 * HOLE: what the launcher does with the facing byte is not this gate's business. The corpus arm
 * runs the launcher for real, so it would notice, but nothing here isolates that step.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-429c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { setTheLaunchFacingInsideOneAimWindow } from "../setTheLaunchFacingInsideOneAimWindow.js";
import { loc_429c as oracle } from "../../translated/loc_429c.js";
import { loc_4243 as dispatcher } from "../../translated/loc_4243.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x429c;
const DISPATCHER = 0x4243;
const LAUNCHER = 0x42b7;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** The three cells, and the two fixed lines — derived here so a module edit cannot pass. */
const WINDOW_HALF_WIDTH = 0xa8e6;
const WINDOW_CENTRE = 0x84;
const FACING_LINE = 0x78;
const OTHER_COORD = 0x31;

const VALUES = 256;
const CORPUS_ENTRIES = 100;
const HALF_WIDTHS = [0x00, 0x01, 0x0a, 0x40, 0x80, 0xff];

/** Measured by the WINDOW-STACK arm: this oracle pushes nothing, so nothing is masked. */
const SCRATCH_BYTES = 0;

/**
 * The ceiling on divergence, and the whole of it. On the arm that ends here the oracle leaves its
 * working value in the accumulator, the comparison in the flags, the half-width in one scratch
 * byte and the DOUBLED half-width in the other, and takes a return the rewrite omits. A CEILING
 * and not a demand — a rewrite that diverged on fewer still passes.
 */
const MOVED = ["a", "f", "c", "d", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured machines ───────────────────────────────────────────────────────────────

/** Dispatch counts for this address AND its dispatcher, under one tape. */
function dispatchCounts(opts) {
  const seen = { [TARGET]: 0, [DISPATCHER]: 0 };
  const overrides = new Map([
    [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
    [DISPATCHER, (mm) => { seen[DISPATCHER]++; return dispatcher(mm); }],
  ]);
  const m = makeMachine(overrides, opts);
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `run stopped early: ${m.stoppedBy}`);
  return seen;
}

let captured = null;

function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

// ── comparison ──────────────────────────────────────────────────────────────────────────

/** A routine map whose launcher records what it was handed and returns instead of launching. */
function recorderRoutines(seen) {
  const map = buildRoutines();
  map.set(LAUNCHER, (mm) => {
    seen.push({ c: mm.regs.c, ix: mm.regs.ix, iy: mm.regs.iy });
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

/** Set the three bytes this routine reads on a machine. */
function place(mm, half, coord, other) {
  mm.mem8[WINDOW_HALF_WIDTH] = half;
  mm.mem8[mm.regs.iy] = coord;
  mm.mem8[(mm.regs.iy + OTHER_COORD) & 0xffff] = other;
}

/** What the recorder saw for one crafted placement, or null when the routine ended instead. */
function stagedFacing(half, coord, other) {
  const seen = [];
  const probe = capture()[0].clone();
  probe.routines = recorderRoutines(seen);
  place(probe, half, coord, other);
  setTheLaunchFacingInsideOneAimWindow(probe);
  return seen.length === 0 ? null : seen[0].c;
}

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

/** Every half-width, with both coordinates held at the captured entry's own values. */
function sweepHalfWidth(candidate) {
  const base = capture()[0];
  const coord = base.mem8[base.regs.iy];
  const other = base.mem8[(base.regs.iy + OTHER_COORD) & 0xffff];
  let caught = 0;
  for (let half = 0; half < VALUES; half++) {
    if (stagedDiff(candidate, base, (mm) => place(mm, half, coord, other))) caught++;
  }
  return caught;
}

/** Every value of the gating coordinate, at six half-widths spanning the doubling wrap. */
function sweepCoordinate(candidate) {
  const base = capture()[0];
  let caught = 0;
  for (const half of HALF_WIDTHS) {
    for (let coord = 0; coord < VALUES; coord++) {
      if (stagedDiff(candidate, base, (mm) => place(mm, half, coord, 0x40))) caught++;
    }
  }
  return caught;
}

/** Every value of the other coordinate, with the window held open. */
function sweepFacing(candidate) {
  const base = capture()[0];
  let caught = 0;
  for (let other = 0; other < VALUES; other++) {
    if (stagedDiff(candidate, base, (mm) => place(mm, 0x40, WINDOW_CENTRE, other))) caught++;
  }
  return caught;
}

const SWEEP_RUNS = {
  halfWidth: VALUES,
  coordinate: HALF_WIDTHS.length * VALUES,
  facing: VALUES,
};

/** Which arm an entry takes, decided from the cells rather than from either arm's code. */
function armOf(mm) {
  const half = mm.mem8[WINDOW_HALF_WIDTH];
  const reach = (WINDOW_CENTRE - mm.mem8[mm.regs.iy] + half) & 0xff;
  if (reach >= ((half + half) & 0xff)) return "outside";
  return mm.mem8[(mm.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? "far" : "near";
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: launches whatever the coordinate is, so the window gates nothing. */
function brokenWindowAlwaysOpen(m) {
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: takes the window as the half-width rather than the doubled one, halving its reach. */
function brokenWindowNotDoubled(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= half) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: never re-centres, so the window sits at the origin instead of on the line. */
function brokenWindowNotCentred(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy]) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: hands over the facing the other way round. */
function brokenFacingInverted(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 0 : 1;
  return m.call(LAUNCHER);
}

/** BUG: puts the line one place along, so the coordinate ON it flips to the wrong side. */
function brokenFacingLineOffByOne(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] >= FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: reads the facing off the gating coordinate instead of the other one. */
function brokenFacingFromWrongAxis(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[m.regs.iy] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: scribbles on a register outside the ceiling — the control for the EXCLUDED arm. */
function brokenMovesHl(m) {
  setTheLaunchFacingInsideOneAimWindow(m);
  m.regs.hl = (m.regs.hl + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["window-always-open", brokenWindowAlwaysOpen],
  ["window-not-doubled", brokenWindowNotDoubled],
  ["window-not-centred", brokenWindowNotCentred],
  ["facing-inverted", brokenFacingInverted],
  ["facing-line-off-by-one", brokenFacingLineOffByOne],
  ["facing-from-wrong-axis", brokenFacingFromWrongAxis],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the driven tape dispatches it, the idle one cannot", { skip }, () => {
  const driven = dispatchCounts({});
  const idle = dispatchCounts({ tape: [] });
  assert.ok(driven[TARGET] > 0, "vacuous: the tape never reached the routine");
  // The idle zero is only worth reporting alongside the reason: its dispatcher runs zero times too.
  assert.equal(idle[DISPATCHER], 0, "the idle tape DOES run the dispatcher now, so its zero for " +
    "this address needs a different explanation than the one stated here");
  console.log(`  REACH: ${hex4(TARGET)} entered ${driven[TARGET]} times driven and ` +
    `${idle[TARGET]} idle; its dispatcher ${hex4(DISPATCHER)} entered ` +
    `${driven[DISPATCHER]} and ${idle[DISPATCHER]}`);
});

test("WINDOW-STACK: the oracle pushes nothing, measured over the corpus", { skip }, () => {
  let deepest = 0;
  for (const e of capture()) deepest = Math.max(deepest, oracleDepth(e));
  console.log(`  WINDOW-STACK (measured): the oracle reaches ${deepest} bytes below its seat, so ` +
    "the whole dump is compared with nothing masked");
  assert.equal(deepest, SCRATCH_BYTES, "the oracle now pushes, so a masked window is owed and " +
    "every arm here is comparing bytes it has no right to");
});

test("CORPUS: every captured machine replays identically", { skip }, () => {
  const entries = capture();
  assert.notEqual(entries[0] ?? null, null, "vacuous: the tape never reached the routine");
  for (const e of entries) {
    const d = unitDiff(setTheLaunchFacingInsideOneAimWindow, e);
    assert.equal(d, null, show(d));
  }
  console.log(`  CORPUS: ${entries.length} captured machines identical, with the real launcher ` +
    "running underneath");
});

test("ARMS: the corpus takes all three arms", { skip }, () => {
  const tally = { outside: 0, near: 0, far: 0 };
  for (const e of capture()) tally[armOf(e)]++;
  console.log(`  ARMS: outside ${tally.outside}, near ${tally.near}, far ${tally.far}`);
  for (const arm of ["outside", "near", "far"]) {
    assert.ok(tally[arm] > 0, `the corpus never takes the ${arm} arm, so the real-launcher arm is ` +
      "not covering it and only the recorder sweeps are");
  }
});

test("HALF-WIDTH: all 256 half-widths", { skip }, () => {
  assert.equal(sweepHalfWidth(setTheLaunchFacingInsideOneAimWindow), 0, "a half-width diverged");
  console.log(`  HALF-WIDTH: ${SWEEP_RUNS.halfWidth} values identical`);
});

test("COORDINATE: all 256 gating coordinates, at six half-widths", { skip }, () => {
  assert.equal(sweepCoordinate(setTheLaunchFacingInsideOneAimWindow), 0, "a coordinate diverged");
  console.log(`  COORDINATE: ${SWEEP_RUNS.coordinate} coordinate-and-half-width pairs identical`);
});

test("FACING: all 256 values of the other coordinate", { skip }, () => {
  assert.equal(sweepFacing(setTheLaunchFacingInsideOneAimWindow), 0, "a facing coordinate diverged");
  console.log(`  FACING: ${SWEEP_RUNS.facing} values identical`);
});

/**
 * Which coordinates the window admits, built as a SET by walking back from its top edge — the
 * other way round from the subtract-and-compare the routine performs, so the two can disagree.
 */
function windowMembers(half) {
  const width = (half + half) & 0xff;
  const top = (WINDOW_CENTRE + half) & 0xff;
  const members = new Set();
  for (let k = 0; k < width; k++) members.add((top - k) & 0xff);
  return members;
}

test("SHAPE: which coordinates the window admits, pinned as a set", { skip }, () => {
  const shut = [];
  for (const half of [...HALF_WIDTHS, 0xc0, 0x7f, 0x81]) {
    const members = windowMembers(half);
    if (members.size === 0) shut.push(half);
    for (let coord = 0; coord < VALUES; coord++) {
      const open = stagedFacing(half, coord, 0x00) !== null;
      assert.equal(open, members.has(coord),
        `half-width ${hex4(half)} at coordinate ${hex4(coord)}: the routine says ` +
          `${open ? "inside" : "outside"} and the set says the opposite`);
    }
  }
  assert.deepEqual(shut, [0x00, 0x80], "the half-widths that shut the window have changed, so the " +
    "doubling no longer wraps the way this arm and the header both say it does");
  console.log(`  SHAPE: nine half-widths agree with the set over all ${VALUES} coordinates; ` +
    `${shut.map(hex4).join(" and ")} shut it entirely`);
});

test("FACING LINE: the line itself is one side, one place past it the other", { skip }, () => {
  const half = 0x0a;
  assert.equal(stagedFacing(half, WINDOW_CENTRE, FACING_LINE), 0, "the line itself is the near side");
  assert.equal(stagedFacing(half, WINDOW_CENTRE, FACING_LINE + 1), 1,
    "one place past the line is the far side");
  assert.equal(stagedFacing(half, WINDOW_CENTRE, 0x00), 0, "the bottom of the range is the near side");
  assert.equal(stagedFacing(half, WINDOW_CENTRE, 0xff), 1, "the top of the range is the far side");
  console.log(`  FACING LINE: the split falls between ${hex4(FACING_LINE)} and ` +
    `${hex4(FACING_LINE + 1)}, with the line itself on the near side`);
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
  const moved = movedOver(setTheLaunchFacingInsideOneAimWindow);
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
    const halfWidth = sweepHalfWidth(twin);
    const coordinate = sweepCoordinate(twin);
    const facing = sweepFacing(twin);
    console.log(`  TEETH/${label}: caught on ${halfWidth}/${SWEEP_RUNS.halfWidth} half-widths, ` +
      `${coordinate}/${SWEEP_RUNS.coordinate} coordinates, ${facing}/${SWEEP_RUNS.facing} facings`);
    assert.ok(halfWidth + coordinate + facing > 0, `every sweep PASSED the ${label} twin`);
  });
}
