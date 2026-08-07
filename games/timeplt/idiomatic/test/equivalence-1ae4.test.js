// SPDX-License-Identifier: GPL-3.0-only
/**
 * freeAndNumberEveryObjectSlot — memory-equivalent to the frozen oracle at ROM 0x1AE4.
 *
 * GATE: strict unit-capture at the real dispatches the shared coin -> start tape produces, plus a
 *   seeded crafted arm and teeth. The routine takes NO input — every address, stride and count is
 *   an immediate — so what a gate must catch is a wrong extent, a wrong stride, or a wrong stamp.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at every real dispatch — the whole state dump is identical, the stack included: the
 *      routine pushes nothing, so the exclusion window is measured at ZERO bytes and asserted so.
 *   2. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   3. EXCLUDED, deliberately — the register set that may differ is pinned by measurement.
 *   4. THE RUN LANDS — the whole run is seeded with a pattern first, so every cell the routine
 *      writes provably CHANGED, and each record is then read back and checked.
 *   5. SEEDED CRAFTED ARM — the same comparison from entry states whose record run has been
 *      filled with three different patterns, which is the only input this routine has.
 *   6. TEETH — six twins with exact catch counts over the seeds, so a twin caught on the WRONG
 *      seeds fails as loudly as one not caught at all.
 *
 * HOLE: there is no input space to sweep, so nothing here distinguishes states the game reaches
 * from states it does not; the seeds are chosen, not observed.
 * HOLE: nothing here says what the stamped byte is FOR. The gate fixes the extent, the stride and
 * the two bytes each record receives.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1ae4.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { freeAndNumberEveryObjectSlot } from "../freeAndNumberEveryObjectSlot.js";
import { loc_1ae4 as oracle } from "../../translated/loc_1ae4.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x1ae4;
const FRAMES = 800;
const DISPATCHES = 1;

const FIRST_RECORD = 0xa810;
const RECORD_BYTES = 16;
const RECORDS = 23;
const STATE = 0;
const NUMBER = 15;
const RUN_BYTES = RECORDS * RECORD_BYTES;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["a", "f", "ix", "sp"];

const SEEDS = [0x00, 0x5a, 0xff];

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
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
  candidate(b);
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

let entry = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    const sp = mm.regs.sp;
    const b = mm.clone();
    candidate(b);
    const r = oracle(mm);
    if (allDiffs(mm, b).some((d) => !inScratch(d.addr, sp))) caught++;
    return r;
  }]]));
  const frames = host.runFrames(FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "session ran short");
  return { dispatches, caught };
}

function entryState() {
  if (entry === null) replay(freeAndNumberEveryObjectSlot);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** A real captured machine with the whole record run filled with one byte. */
function seeded(fill) {
  const m = entryState().clone();
  for (let i = 0; i < RUN_BYTES; i++) m.mem8[FIRST_RECORD + i] = fill;
  return m;
}

function seedCaught(candidate) {
  return SEEDS.filter((fill) => unitDiff(candidate, seeded(fill))).length;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

function layOut(m, records, stride, firstNumber, numberAt, clearState) {
  const { mem8 } = m;
  for (let i = 0; i < records; i++) {
    const record = FIRST_RECORD + i * stride;
    if (clearState) mem8[record + STATE] = 0;
    mem8[record + numberAt] = firstNumber + i;
  }
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: one record short, so the last one keeps whatever it held. */
function brokenShortRun(m) {
  layOut(m, RECORDS - 1, RECORD_BYTES, 1, NUMBER, true);
}

/** BUG: one record too many, so a record past the run is trampled. */
function brokenLongRun(m) {
  layOut(m, RECORDS + 1, RECORD_BYTES, 1, NUMBER, true);
}

/** BUG: numbers from zero, so every record is one out. */
function brokenNumbersFromZero(m) {
  layOut(m, RECORDS, RECORD_BYTES, 0, NUMBER, true);
}

/** BUG: the stamp goes one byte early. */
function brokenNumberAt(m) {
  layOut(m, RECORDS, RECORD_BYTES, 1, NUMBER - 1, true);
}

/** BUG: leaves the first byte of each record standing. */
function brokenKeepsState(m) {
  layOut(m, RECORDS, RECORD_BYTES, 1, NUMBER, false);
}

/**
 * Each twin's exact catch count over the three seeded states. The last is caught on TWO of the
 * three: with the run filled with zeroes the state byte already holds what the routine would put
 * there, so failing to clear it is invisible — which is why the count is asserted and not a
 * blanket "caught everywhere".
 */
const TWINS = [
  ["no-op", brokenNoOp, 3],
  ["short-run", brokenShortRun, 3],
  ["long-run", brokenLongRun, 3],
  ["numbers-from-zero", brokenNumbersFromZero, 3],
  ["number-one-byte-early", brokenNumberAt, 3],
  ["keeps-the-state-byte", brokenKeepsState, 2],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: freeAndNumberEveryObjectSlot == oracle over the whole dump", { skip }, () => {
  const r = replay(freeAndNumberEveryObjectSlot);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged at a real dispatch");

  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  freeAndNumberEveryObjectSlot(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: ${r.dispatches} dispatch, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, seeded(0x5a));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  freeAndNumberEveryObjectSlot(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("THE RUN LANDS: every record is cleared and stamped, and nothing else moves", { skip }, () => {
  const m = seeded(0x5a);
  freeAndNumberEveryObjectSlot(m);
  for (let i = 0; i < RECORDS; i++) {
    const record = FIRST_RECORD + i * RECORD_BYTES;
    assert.equal(m.mem8[record + STATE], 0, `record ${i} state`);
    assert.equal(m.mem8[record + NUMBER], i + 1, `record ${i} number`);
  }
  const past = seeded(0x5a);
  assert.equal(m.mem8[FIRST_RECORD + RUN_BYTES], past.mem8[FIRST_RECORD + RUN_BYTES],
    "the byte past the run must be untouched");
  assert.equal(m.mem8[FIRST_RECORD + 1], 0x5a, "a record's other bytes must be untouched");
  console.log(`  LANDS: ${RECORDS} records from ${hex4(FIRST_RECORD)}, both bytes each`);
});

test("SEEDED: the rewrite matches the oracle from three different record runs", { skip }, () => {
  for (const fill of SEEDS) {
    assert.equal(unitDiff(freeAndNumberEveryObjectSlot, seeded(fill)), null, `seed ${fill} diverged`);
  }
  console.log(`  SEEDED: ${SEEDS.length} filled runs, identical on each`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, caught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of seeded states`, { skip }, () => {
    assert.equal(seedCaught(twin), caught, `the ${label} twin's catch count moved`);
    assert.ok(caught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${SEEDS.length} seeded states`);
  });
}
