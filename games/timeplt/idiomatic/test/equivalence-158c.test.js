// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_158c — memory-equivalent to the frozen oracle at ROM 0x158C.
 *
 * ★ NOT REACHED BY EITHER SESSION THIS FILE DRIVES. The two call sites sit inside steps of the
 *   sequence machine that neither an undriven attract run nor a driven one enters, which the
 *   control arm below measures rather than asserts from reading. There is therefore NO real
 *   capture OF THIS ENTRY, and the arms below run from a real machine state captured at a routine
 *   the same frame does reach — a genuine in-play machine with a surgical entry, not a
 *   fabrication. Forcing the sequence cell that selects it is NOT a route: that cell is consumed
 *   by several dispatchers under different masks, and holding it sends an unrelated one into
 *   unmapped memory.
 *
 * GATE: crafted entry, with a negative control, a seeded sweep and teeth.
 *
 * What it exercises, with the holes stated:
 *   1. NEGATIVE CONTROL — a 4000-frame attract session and a 4000-frame driven session both
 *      dispatch this address ZERO times. Asserted.
 *   2. EQUAL from the crafted entry — the whole state dump is identical, the stack included: the
 *      routine pushes nothing, so the exclusion window is measured at ZERO bytes and asserted so.
 *   3. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   4. EXCLUDED, deliberately — the register set that may differ is pinned by measurement.
 *   5. SEEDED SWEEP — four different patterns written over the source cells, so every destination
 *      byte provably changes and no comparison can pass by both sides leaving a cell alone.
 *   6. THE GATHER LANDS — the full source map is checked byte by byte, the four tail cells
 *      included, and every cell outside the run is checked to be untouched.
 *   7. TEETH — seven twins with exact catch counts over the seeded sweep.
 *
 * HOLE: no real entry state, so nothing here says what the column holds in play or when the
 * gather matters. It fixes the map: which cell goes to which byte.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-158c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { loc_158c } from "../loc_158c.js";
import { loc_158c as oracle } from "../../translated/loc_158c.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x158c;
/** A routine the same frame DOES reach, used only to take a live machine to craft from. */
const CAPTURE_AT = 0x52d2;
const CAPTURE_FRAMES = 400;
const CONTROL_FRAMES = 4000;

const RUN = 0xa400;
const COLUMN = 0xa451;
const ROW = 0x20;
const COLUMN_CELLS = 28;
const STUB_COLUMNS = [0xa5f0, 0xa5f2];
const STUB_CELLS = 2;
const RUN_BYTES = COLUMN_CELLS + STUB_COLUMNS.length * STUB_CELLS;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];

const SEEDS = [0, 17, 200, 255];

const IN0 = 0xc300;
const IN1 = 0xc320;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** Which cell the i'th byte of the run is gathered FROM. */
function sourceOf(i) {
  if (i < COLUMN_CELLS) return COLUMN + i * ROW;
  const tail = i - COLUMN_CELLS;
  return STUB_COLUMNS[Math.floor(tail / STUB_CELLS)] + (tail % STUB_CELLS) * ROW;
}

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

function playTape(frames) {
  const tape = [
    { frame: 401, port: IN0, bits: 0x01, dur: 8 },
    { frame: 501, port: IN0, bits: 0x08, dur: 8 },
    { frame: 600, port: IN1, bits: 0x10, dur: frames },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09];
  let frame = 640;
  while (frame < frames) {
    for (const bits of compass) {
      tape.push({ frame, port: IN1, bits, dur: 40 });
      frame += 40;
    }
  }
  return tape;
}

/** How many times a session dispatches this address. Used only by the control. */
function dispatchesIn(opts) {
  let dispatches = 0;
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    return oracle(mm);
  }]]), opts);
  const frames = host.runFrames(CONTROL_FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, CONTROL_FRAMES, "session ran short");
  return dispatches;
}

let captured = null;

function captureState() {
  if (captured !== null) return captured;
  const capturedRoutine = buildRoutines().get(CAPTURE_AT);
  const host = makeMachine(new Map([[CAPTURE_AT, (mm, ...args) => {
    if (captured === null) captured = mm.clone();
    return capturedRoutine(mm, ...args);
  }]]));
  host.runFrames(CAPTURE_FRAMES);
  assert.notEqual(captured, null, "vacuous: the capture routine was never dispatched either");
  return captured;
}

/** A real captured machine with the source cells filled with a pattern and the run cleared. */
function seeded(offset) {
  const m = captureState().clone();
  for (let i = 0; i < RUN_BYTES; i++) m.mem8[sourceOf(i)] = (i * 7 + offset) & 0xff;
  for (let i = 0; i < RUN_BYTES; i++) m.mem8[RUN + i] = 0;
  return m;
}

function seedCaught(candidate) {
  return SEEDS.filter((offset) => unitDiff(candidate, seeded(offset))).length;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

function gather(m, cells, stride, stubs, stubCells, scatter) {
  const { mem8 } = m;
  let destination = RUN;
  for (let i = 0; i < cells; i++) {
    const at = COLUMN + i * stride;
    if (scatter) mem8[at] = mem8[destination];
    else mem8[destination] = mem8[at];
    destination++;
  }
  for (const stub of stubs) {
    for (let i = 0; i < stubCells; i++) {
      const at = stub + i * stride;
      if (scatter) mem8[at] = mem8[destination];
      else mem8[destination] = mem8[at];
      destination++;
    }
  }
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: one cell short of the column. */
function brokenShortColumn(m) {
  gather(m, COLUMN_CELLS - 1, ROW, STUB_COLUMNS, STUB_CELLS, false);
}

/** BUG: one cell too many. */
function brokenLongColumn(m) {
  gather(m, COLUMN_CELLS + 1, ROW, STUB_COLUMNS, STUB_CELLS, false);
}

/** BUG: steps a row and a cell instead of a row. */
function brokenStride(m) {
  gather(m, COLUMN_CELLS, ROW + 1, STUB_COLUMNS, STUB_CELLS, false);
}

/** BUG: the two stubs are taken the other way round. */
function brokenStubOrder(m) {
  gather(m, COLUMN_CELLS, ROW, [...STUB_COLUMNS].reverse(), STUB_CELLS, false);
}

/** BUG: the column is copied and the four tail cells are dropped. */
function brokenNoStubs(m) {
  gather(m, COLUMN_CELLS, ROW, [], STUB_CELLS, false);
}

/** BUG: copies the other way, which is the sibling operation and not this one. */
function brokenScatters(m) {
  gather(m, COLUMN_CELLS, ROW, STUB_COLUMNS, STUB_CELLS, true);
}

/** Each twin's exact catch count over the four seeded states. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 4],
  ["short-column", brokenShortColumn, 4],
  ["long-column", brokenLongColumn, 4],
  ["stride-one-too-far", brokenStride, 4],
  ["stubs-reversed", brokenStubOrder, 4],
  ["no-stubs", brokenNoStubs, 4],
  ["scatters-instead", brokenScatters, 4],
];

// ── the control ─────────────────────────────────────────────────────────────────────────

test("NEGATIVE CONTROL: neither attract nor a driven session dispatches this address", { skip }, () => {
  assert.equal(dispatchesIn({ tape: [] }), 0, "attract reached it, so the crafted arm is not needed");
  assert.equal(dispatchesIn({ tape: playTape(CONTROL_FRAMES) }), 0, "a driven session reached it");
  console.log(`  CONTROL: zero dispatches in ${CONTROL_FRAMES} frames of each of two sessions`);
});

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL from the crafted entry: loc_158c == oracle over the whole dump", { skip }, () => {
  for (const offset of SEEDS) {
    const m = seeded(offset);
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    loc_158c(b);
    assert.deepEqual(allDiffs(a, b), [], `seed ${offset}: the dumps must agree byte for byte`);
  }
  console.log(`  EQUAL: ${SEEDS.length} seeded entries, no byte differs on any`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, seeded(17));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const m = seeded(17);
  const a = m.clone();
  const b = m.clone();
  oracle(a);
  loc_158c(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("THE GATHER LANDS: every source cell reaches its own byte, and no other moves", { skip }, () => {
  const m = seeded(17);
  const sources = Array.from({ length: RUN_BYTES }, (_unused, i) => m.mem8[sourceOf(i)]);
  const before = m.clone();
  loc_158c(m);
  for (let i = 0; i < RUN_BYTES; i++) {
    assert.equal(m.mem8[RUN + i], sources[i], `byte ${i} did not come from ${hex4(sourceOf(i))}`);
  }
  const moved = allDiffs(before, m).map((d) => d.addr).sort((x, y) => x - y);
  const expected = Array.from({ length: RUN_BYTES }, (_unused, i) => RUN + i);
  assert.deepEqual(moved, expected, "a cell outside the run changed");
  assert.equal(new Set(sources).size > 1, true, "vacuous: the seeded column is all one byte");
  console.log(`  LANDS: ${RUN_BYTES} bytes gathered, nothing outside the run moved`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, seedsCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of seeded states`, { skip }, () => {
    assert.equal(seedCaught(twin), seedsCaught, `the ${label} twin's catch count moved`);
    assert.ok(seedsCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${seedsCaught} of ${SEEDS.length} seeded states`);
  });
}
