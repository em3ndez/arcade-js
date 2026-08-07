// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadDifficultyRecord — memory-equivalent to the frozen oracle at ROM 0x0F7B.
 *
 * GATE: strict unit-capture at the one real dispatch the shared coin -> start tape produces,
 *   plus an exhaustive crafted sweep over the index, plus teeth.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at the real dispatch — identical outside a two-byte scratch window.
 *   2. THE SCRATCH WINDOW IS THE ONE EXCLUSION, pinned to [SP-2, SP): the oracle brackets its
 *      address step with a pushed return address and the rewrite models no stack. Every arm
 *      walks the whole dump and asserts nothing escapes the window, so it cannot quietly widen.
 *   3. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   4. EXCLUDED, deliberately — the register set that may differ is pinned by measurement.
 *   5. THE RECORD LANDS — the four written cells are read back and matched against the table
 *      entry the index selects, so the RAM arm is not vacuous on the cells that matter.
 *   6. EXHAUSTIVE — all 256 indices crafted onto the real entry state. This is the load-bearing
 *      arm: the real dispatch presents ONE index, which the corpus arm asserts as a set.
 *   7. TEETH — six twins with exact catch counts over the crafted sweep, so a twin caught on the
 *      WRONG set of indices fails as loudly as one not caught at all.
 *
 * HOLE: the corpus is a single dispatch carrying a single index, so real data discriminates
 * almost nothing here and every claim about the index space rests on the crafted sweep.
 * HOLE: nothing here says what the four copied bytes MEAN. The gate fixes which record is copied
 * and where it goes.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0f7b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { loadDifficultyRecord } from "../loadDifficultyRecord.js";
import { loc_0f7b as oracle } from "../../translated/loc_0f7b.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { START_RUNG_ROUNDS_1_5 } from "../names.js";

const TARGET = 0x0f7b;
const FRAMES = 700;
const DISPATCHES = 1;

const RECORD_TABLE = 0x186a;
const RECORD_BYTES = 4;

const SCRATCH_BYTES = 2;
const EXCLUDED = ["f", "b", "c", "d", "e", "l", "sp"];

const INDICES = Array.from({ length: 256 }, (_unused, i) => i);

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
  const indices = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    indices.add(mm.regs.a);
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
  return { dispatches, caught, indices };
}

function entryState() {
  if (entry === null) replay(loadDifficultyRecord);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** A real captured machine with the index forced — the crafted-entry idiom. */
function craft(index) {
  const m = entryState().clone();
  m.regs.a = index;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const index of INDICES) if (unitDiff(candidate, craft(index))) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: copies three bytes, leaving the fourth cell holding whatever was there. */
function brokenThreeBytes(m) {
  copy(m, m.regs.a, 3, RECORD_TABLE, 4);
}

/** BUG: copies five, so a cell past the settings is trampled. */
function brokenFiveBytes(m) {
  copy(m, m.regs.a, 5, RECORD_TABLE, 4);
}

/** BUG: scales the index by two, so it lands on the wrong record from index one on. */
function brokenHalfStride(m) {
  copy(m, m.regs.a, 4, RECORD_TABLE, 2);
}

/** BUG: the table starts one byte early. */
function brokenTableOffByOne(m) {
  copy(m, m.regs.a, 4, RECORD_TABLE - 1, 4);
}

/**
 * BUG: scales the index WITHOUT wrapping it to a byte, so it reads past the table for every
 * index of sixty-four or more. No real dispatch could ever tell this apart.
 */
function brokenWideIndex(m) {
  const { mem8 } = m;
  const record = RECORD_TABLE + m.regs.a * RECORD_BYTES;
  for (let i = 0; i < RECORD_BYTES; i++) mem8[START_RUNG_ROUNDS_1_5 + i] = mem8[record + i];
}

function copy(m, index, bytes, table, stride) {
  const { mem8 } = m;
  const record = (table + ((index * stride) & 0xff)) & 0xffff;
  for (let i = 0; i < bytes; i++) mem8[START_RUNG_ROUNDS_1_5 + i] = mem8[record + i];
}

/** Each twin's exact catch count over the 256 crafted indices. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["three-bytes", brokenThreeBytes, 256],
  ["five-bytes", brokenFiveBytes, 248],
  ["half-stride", brokenHalfStride, 254],
  ["table-off-by-one", brokenTableOffByOne, 256],
  ["wide-index", brokenWideIndex, 192],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loadDifficultyRecord == oracle outside the scratch window", { skip }, () => {
  const r = replay(loadDifficultyRecord);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged at a real dispatch");
  assert.equal(r.indices.size, 1, "the corpus now presents more than one index");

  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loadDifficultyRecord(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  const window = allDiffs(a, b).map((d) => d.addr);
  assert.ok(window.every((addr) => inScratch(addr, sp)), "the window is exactly two bytes below sp");
  console.log(
    `  EQUAL: ${r.dispatches} dispatch with index ${[...r.indices]}, sp=${hex4(sp)}; ` +
      `${window.length} byte(s) differ, all inside the window`,
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loadDifficultyRecord(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("THE RECORD LANDS: the four cells hold the entry the index selects", { skip }, () => {
  for (const index of [0, 1, 7, 63]) {
    const m = craft(index);
    loadDifficultyRecord(m);
    const record = RECORD_TABLE + index * RECORD_BYTES;
    for (let i = 0; i < RECORD_BYTES; i++) {
      assert.equal(m.mem8[START_RUNG_ROUNDS_1_5 + i], m.mem8[record + i], `index ${index} byte ${i}`);
    }
  }
  const zero = craft(0);
  loadDifficultyRecord(zero);
  const one = craft(1);
  loadDifficultyRecord(one);
  assert.notDeepEqual(
    [0, 1, 2, 3].map((i) => zero.mem8[START_RUNG_ROUNDS_1_5 + i]),
    [0, 1, 2, 3].map((i) => one.mem8[START_RUNG_ROUNDS_1_5 + i]),
    "vacuous: two different indices copied the same four bytes",
  );
  console.log("  LANDS: four cells match the selected record, and two indices differ");
});

test("EXHAUSTIVE: all 256 crafted indices behave as the oracle", { skip }, () => {
  assert.equal(sweepCaught(loadDifficultyRecord), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${INDICES.length} indices identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted indices`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${INDICES.length} indices`);
  });
}
