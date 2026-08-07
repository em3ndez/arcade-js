// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireEntryPairIntoCooldown — memory-equivalent to the frozen oracle at ROM 0x46DB.
 *
 * GATE: strict unit-capture on a REAL dispatch, plus a crafted sweep over base pairs with the six
 *   touched cells planted. No exclusion of any kind: the routine calls nothing, so nothing is
 *   pushed and the raw whole-dump comparison is the gate.
 *
 * THE ENTRY BUDGET IS NOT THE SHARED ONE, and that is a measurement. The first dispatch on the
 *   undriven attract tape is frame 3700 and on the shared coin -> start tape frame 5985, both past
 *   the shared budget, so this file runs attract to 3800 frames to reach one. That single run is
 *   cached and every other arm works from clones of the entry it captured.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — the whole state dump identical, accumulator identical.
 *   2. ONE REAL DISPATCH, AND IT EXERCISES ALMOST NOTHING. Measured: all five cells the routine
 *      zeroes ALREADY read zero when it is entered, so the only observable write on real data is
 *      the constant into record byte 14. The test asserts that rather than leaving it implied, and
 *      it is why the crafted sweep below is the load-bearing arm.
 *   3. CRAFTED SWEEP — eight base pairs, each with all six touched cells and their neighbours
 *      planted with distinctive values, so every store the routine makes is observable and any
 *      store it makes that the oracle does not is observable too. Two pairs put the record's
 *      stocked byte and the entries' second axis across the top of work RAM.
 *   4. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to exactly {f, sp}. The
 *      accumulator is NOT excluded: the rewrite is held to the zero the oracle leaves.
 *   5. TEETH — seven twins, each asserted caught on an exact count of the crafted space.
 *
 * HOLE: THE FLAG BYTE IS EXCLUDED AND NOT MEASURED. The oracle clears the accumulator with an
 * exclusive-or, which sets the flags; the rewrite assigns zero and does not. Both transfers into
 * this routine are tail transfers, so the flags it leaves reach a caller's caller, and nothing here
 * watches whether one reads them. If a whole-run gate ever fails around this address, this is the
 * first thing to suspect.
 *
 * HOLE: one real dispatch, on one tape, at one base pair. Nothing here speaks for the states a
 * longer or differently-driven session would present.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-46db.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { retireEntryPairIntoCooldown } from "../retireEntryPairIntoCooldown.js";
import { loc_46db as oracle } from "../../translated/loc_46db.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";
import { MOTHER_SHIP_STATE } from "../names.js";

const TARGET = 0x46db;

/** Measured: the first dispatch of the attract tape. The budget clears it by a hundred frames. */
const FIRST_DISPATCH_FRAME = 3700;
const BUDGET = 3800;

const NEXT_ENTRY = 2;
const SECOND_AXIS = 49;
const RECORD_BYTE = 14;
const RECORD_CODE = 95;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const REAL_ENTRY = 0xaa24;

// ── the one expensive run ───────────────────────────────────────────────────────────────────

let captured = null;

/** Run attract far enough to reach a dispatch, comparing the candidate at each one. */
function replay(candidate) {
  const base = buildRoutines();
  const original = base.get(TARGET);
  let dispatches = 0;
  let caught = 0;
  let firstFrame = null;
  let entry = null;
  const overrides = new Map([[TARGET, (mm) => {
    dispatches++;
    if (firstFrame === null) firstFrame = mm.frames.length;
    if (entry === null) entry = mm.clone();
    if (unitDiff(candidate, mm)) caught++;
    return original(mm);
  }]]);
  const m = makeMachine(overrides, { tape: [] });
  const frames = m.runFrames(BUDGET);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, BUDGET, "session ran short");
  return { dispatches, caught, firstFrame, entry };
}

function session() {
  if (captured === null) captured = replay(retireEntryPairIntoCooldown);
  return captured;
}

const entryState = () => session().entry;

/** Whole state dump plus the accumulator: oracle against candidate on clones of one machine. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  if (a.regs.a !== b.regs.a) return { addr: null, a: a.regs.a, b: b.regs.a };
  return null;
}

// ── the crafted space ───────────────────────────────────────────────────────────────────────

/**
 * Eight base pairs. The first is the pair the real dispatch presents; the middle ones are further
 * slots of the same two arrays; the last two put the touched cells across the top of work RAM.
 */
const BASE_PAIRS = [
  [0xa8a0, 0xaa24],
  [0xa810, 0xaa10],
  [0xa8e0, 0xaa2c],
  [0xa890, 0xaa40],
  [0xa8f0, 0xaa2e],
  [0xa850, 0xaa60],
  [0xaff0, 0xafa0],
  [0xaffc, 0xafb2],
];

/** Distinctive values, one per cell, so a store to the wrong cell shows up as the wrong value. */
const PLANT = [
  [0, 0x5a],
  [RECORD_BYTE, 0x2e],
  [RECORD_BYTE + 1, 0x8d],
];
const PLANT_ENTRY = [
  [0, 0x6b],
  [NEXT_ENTRY, 0x71],
  [NEXT_ENTRY + NEXT_ENTRY, 0x74],
  [SECOND_AXIS, 0x7c],
  [SECOND_AXIS + NEXT_ENTRY, 0x83],
  [SECOND_AXIS + NEXT_ENTRY + NEXT_ENTRY, 0x91],
];

function craft(record, entry) {
  const m = entryState().clone();
  m.regs.ix = record;
  m.regs.iy = entry;
  for (const [off, v] of PLANT) m.mem8[record + off] = v;
  for (const [off, v] of PLANT_ENTRY) m.mem8[entry + off] = v;
  return m;
}

/** Also sweep the accumulator, since the oracle's zero is a live-out the rewrite must reproduce. */
const INCOMING_A = [0, 1, 0x5f, 0x80, 0xff];
const SWEEP_SIZE = BASE_PAIRS.length * INCOMING_A.length;

function sweepCaught(candidate) {
  let caught = 0;
  for (const [record, entry] of BASE_PAIRS) {
    for (const a of INCOMING_A) {
      const m = craft(record, entry);
      m.regs.a = a;
      if (unitDiff(candidate, m)) caught++;
    }
  }
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: retireEntryPairIntoCooldown == oracle on RAM and the accumulator", { skip: SKIP }, () => {
  const s = session();
  assert.ok(s.dispatches > 0, "vacuous: the attract tape never reached the routine");
  assert.equal(s.dispatches, 1, "the attract dispatch count moved");
  assert.equal(s.firstFrame, FIRST_DISPATCH_FRAME, "the first dispatch moved; re-derive the budget");
  assert.equal(s.caught, 0, "the rewrite diverged at the real dispatch");
  console.log(
    `  EQUAL: frame ${s.firstFrame}, ix=${hex4(entryState().regs.ix)} iy=${hex4(entryState().regs.iy)}; ` +
      "identical, no exclusion",
  );
});

test("THE REAL DISPATCH EXERCISES ONE STORE: the other five cells already read zero", { skip: SKIP }, () => {
  const e = entryState();
  assert.equal(e.regs.ix, MOTHER_SHIP_STATE, "the real record base moved");
  assert.equal(e.regs.iy, REAL_ENTRY, "the real entry base moved");
  const zeroed = [
    e.mem8[MOTHER_SHIP_STATE],
    e.mem8[REAL_ENTRY],
    e.mem8[REAL_ENTRY + NEXT_ENTRY],
    e.mem8[REAL_ENTRY + SECOND_AXIS],
    e.mem8[REAL_ENTRY + SECOND_AXIS + NEXT_ENTRY],
  ];
  assert.deepEqual(
    zeroed,
    [0, 0, 0, 0, 0],
    "a cell the routine zeroes now arrives non-zero, so real data has started to cover what the " +
      "crafted sweep was added to cover and this file's account of the split must be re-derived",
  );
  assert.notEqual(
    e.mem8[MOTHER_SHIP_STATE + RECORD_BYTE],
    RECORD_CODE,
    "the record byte already holds the constant, so even that store is invisible on real data",
  );
  console.log(
    `  ONE STORE: the five zeroed cells all read 0 at entry; record byte 14 goes ` +
      `${e.mem8[MOTHER_SHIP_STATE + RECORD_BYTE]} -> ${RECORD_CODE}`,
  );
});

test("CRAFTED SWEEP: eight base pairs with every touched cell planted", { skip: SKIP }, () => {
  assert.equal(sweepCaught(retireEntryPairIntoCooldown), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  CRAFTED SWEEP: ${SWEEP_SIZE} base x accumulator comparisons identical`);
});

test("EXCLUDED, deliberately: the flag byte, the stack pointer and pc", { skip: SKIP }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  retireEntryPairIntoCooldown(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    ["sp"],
    "the excluded set changed shape at the real dispatch: only the stack pointer may differ, " +
      "because the flag byte there already holds what clearing the accumulator would leave",
  );
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.a, 0, "the oracle leaves the accumulator zero");
  assert.equal(b.regs.a, 0, "so must the rewrite");

  // THE FLAG COINCIDENCE ABOVE IS NOT THE GENERAL CASE, so force a prior where it cannot hold.
  const c = entryState().clone();
  const d = entryState().clone();
  c.regs.f = 0xff;
  d.regs.f = 0xff;
  oracle(c);
  retireEntryPairIntoCooldown(d);
  assert.deepEqual(
    REG_FIELDS.filter((k) => c.regs[k] !== d.regs[k]),
    ["f", "sp"],
    "with a flag prior the oracle must change, the excluded set is the flag byte and the stack " +
      "pointer and nothing more",
  );
  console.log(
    `  EXCLUDED: sp and pc at the real entry (its flag byte already matches); f as well once a ` +
      `differing flag prior is forced — RAM and the accumulator are held throughout`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

const ZERO_FIVE = (m, record, entry) => {
  m.mem8[record] = 0;
  m.mem8[entry] = 0;
  m.mem8[entry + NEXT_ENTRY] = 0;
  m.mem8[entry + SECOND_AXIS] = 0;
  m.mem8[entry + SECOND_AXIS + NEXT_ENTRY] = 0;
};

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: clears only the first of the two entries, the shape a one-entry retire would have. */
function brokenOneEntryOnly(m) {
  m.regs.a = 0;
  m.mem8[m.regs.ix] = 0;
  m.mem8[m.regs.iy] = 0;
  m.mem8[m.regs.iy + SECOND_AXIS] = 0;
  m.mem8[m.regs.ix + RECORD_BYTE] = RECORD_CODE;
}

/** BUG: forgets the second axis of both entries, so half of each coordinate pair survives. */
function brokenFirstAxisOnly(m) {
  m.regs.a = 0;
  m.mem8[m.regs.ix] = 0;
  m.mem8[m.regs.iy] = 0;
  m.mem8[m.regs.iy + NEXT_ENTRY] = 0;
  m.mem8[m.regs.ix + RECORD_BYTE] = RECORD_CODE;
}

/** BUG: clears a third entry as well, so a neighbouring object goes out with this one. */
function brokenClearsThreeEntries(m) {
  m.regs.a = 0;
  ZERO_FIVE(m, m.regs.ix, m.regs.iy);
  m.mem8[m.regs.iy + NEXT_ENTRY + NEXT_ENTRY] = 0;
  m.mem8[m.regs.iy + SECOND_AXIS + NEXT_ENTRY + NEXT_ENTRY] = 0;
  m.mem8[m.regs.ix + RECORD_BYTE] = RECORD_CODE;
}

/** BUG: zeroes the record byte instead of setting the code, which is the plain-retire shape. */
function brokenZeroesRecordByte(m) {
  m.regs.a = 0;
  ZERO_FIVE(m, m.regs.ix, m.regs.iy);
  m.mem8[m.regs.ix + RECORD_BYTE] = 0;
}

/** BUG: the code is one out. */
function brokenCodeOffByOne(m) {
  m.regs.a = 0;
  ZERO_FIVE(m, m.regs.ix, m.regs.iy);
  m.mem8[m.regs.ix + RECORD_BYTE] = RECORD_CODE + 1;
}

/** BUG: right memory, and the accumulator left holding whatever the caller had. */
function brokenDropsAccumulator(m) {
  ZERO_FIVE(m, m.regs.ix, m.regs.iy);
  m.mem8[m.regs.ix + RECORD_BYTE] = RECORD_CODE;
}

/**
 * Per twin: its exact catch count over the crafted space. `drops-accumulator` is hidden on exactly
 * the entries whose incoming accumulator is already zero, one per base pair, and asserting that
 * count is what stops the arm quietly becoming blind to the live-out.
 */
const HIDDEN_BY_ZERO_ACCUMULATOR = BASE_PAIRS.length;

const TWINS = [
  ["no-op", brokenNoOp, SWEEP_SIZE],
  ["one-entry-only", brokenOneEntryOnly, SWEEP_SIZE],
  ["first-axis-only", brokenFirstAxisOnly, SWEEP_SIZE],
  ["clears-three-entries", brokenClearsThreeEntries, SWEEP_SIZE],
  ["zeroes-record-byte", brokenZeroesRecordByte, SWEEP_SIZE],
  ["code-off-by-one", brokenCodeOffByOne, SWEEP_SIZE],
  ["drops-accumulator", brokenDropsAccumulator, SWEEP_SIZE - HIDDEN_BY_ZERO_ACCUMULATOR],
];

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip: SKIP }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's crafted catch count moved`);
    const d = unitDiff(twin, craft(...BASE_PAIRS[1]));
    assert.notEqual(d, null, `the ${label} twin is invisible on the second crafted base pair`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} — ${show(d)}`);
  });
}
