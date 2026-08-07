// SPDX-License-Identifier: GPL-3.0-only
/**
 * dressPlayerSpriteForHeading — memory-equivalent to the frozen oracle at ROM 0x20AF.
 *
 * GATE: strict unit-capture replayed over every dispatch of a real session, plus an exhaustive
 *   crafted sweep over the one cell the routine reads, plus teeth.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at the real dispatch — identical outside a two-byte scratch window.
 *   2. THE SCRATCH WINDOW IS THE ONE EXCLUSION, pinned to [SP-2, SP): the oracle brackets its
 *      address step with a pushed return address and the rewrite models no stack. Every arm walks
 *      the whole dump and asserts nothing escapes the window.
 *   3. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   4. EXCLUDED, deliberately — the register set that may differ is pinned by measurement. It
 *      includes the index register the oracle loads and never reads, which the rewrite drops.
 *   5. CORPUS — every dispatch of a real session replayed on a clone, not a deduplicated sample.
 *      Every one of them presents the SAME direction, which the arm asserts as a set rather than
 *      reporting, so the corpus discriminates nothing about the sector arithmetic.
 *   6. EXHAUSTIVE — all 256 directions crafted onto the real entry state, which is the only arm
 *      that reaches the sectors the session never presents.
 *   7. TEETH — seven twins with exact catch counts over the crafted sweep.
 *
 * HOLE: THE CORPUS PRESENTS ONE PLAYER_HEADING. Every dispatch of the session arrives with the same
 * value in the cell this routine reads, so the crafted sweep is the load-bearing arm and the
 * per-twin catch counts say so: two of the twins are caught on a MINORITY of directions and would
 * be invisible to real data on that showing.
 * HOLE: this fixes which two bytes are written and from which table entry. It says nothing about
 * what the second table's byte MEANS, and nothing about the sprite entry the two cells belong to.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-20af.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { dressPlayerSpriteForHeading } from "../dressPlayerSpriteForHeading.js";
import { loc_20af as oracle } from "../../translated/loc_20af.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { PLAYER_HEADING } from "../names.js";

const TARGET = 0x20af;
const FRAMES = 1200;
const DISPATCHES = 465;

const SHAPE_BY_SECTOR = 0x20ce;
const SECTORS = 32;
const STEPS_PER_SECTOR = 8;
const SHAPE_CELL = 0xaa11;
const ATTRIBUTE_CELL = 0xaa40;

const SCRATCH_BYTES = 2;
const EXCLUDED = ["a", "f", "d", "e", "l", "ix", "sp"];

const DIRECTIONS = Array.from({ length: 256 }, (_unused, i) => i);

/** The directions real play presents at this entry. Measured, and asserted as a set. */
const REAL_DIRECTIONS = [128];

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
  const directions = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    directions.add(mm.mem8[PLAYER_HEADING]);
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
  return { dispatches, caught, directions };
}

function entryState() {
  if (entry === null) replay(dressPlayerSpriteForHeading);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** A real captured machine with the direction cell forced — the crafted-entry idiom. */
function craft(direction) {
  const m = entryState().clone();
  m.mem8[PLAYER_HEADING] = direction;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const d of DIRECTIONS) if (unitDiff(candidate, craft(d))) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

function refresh(m, direction, rounding, table, gap) {
  const { mem8 } = m;
  const sector = ((direction + rounding) & 0xff) >> 3;
  mem8[SHAPE_CELL] = mem8[(table + sector) & 0xffff];
  mem8[ATTRIBUTE_CELL] = mem8[(table + sector + gap) & 0xffff];
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: truncates instead of rounding, so every sector boundary is half a sector out. */
function brokenNoRounding(m) {
  refresh(m, m.mem8[PLAYER_HEADING], 0, SHAPE_BY_SECTOR, SECTORS);
}

/** BUG: rounds the wrong way. */
function brokenRoundsUp(m) {
  refresh(m, m.mem8[PLAYER_HEADING], STEPS_PER_SECTOR - 1, SHAPE_BY_SECTOR, SECTORS);
}

/** BUG: the table starts one byte early. */
function brokenTableOffByOne(m) {
  refresh(m, m.mem8[PLAYER_HEADING], STEPS_PER_SECTOR / 2, SHAPE_BY_SECTOR - 1, SECTORS);
}

/** BUG: the second table is one short of a full run away, so the two get out of step. */
function brokenSecondTableGap(m) {
  refresh(m, m.mem8[PLAYER_HEADING], STEPS_PER_SECTOR / 2, SHAPE_BY_SECTOR, SECTORS - 1);
}

/** BUG: writes the shape and leaves the byte beside it standing. */
function brokenShapeOnly(m) {
  const { mem8 } = m;
  const sector = ((mem8[PLAYER_HEADING] + STEPS_PER_SECTOR / 2) & 0xff) >> 3;
  mem8[SHAPE_CELL] = mem8[SHAPE_BY_SECTOR + sector];
}

/** BUG: the two cells are written the other way round. */
function brokenSwapsCells(m) {
  const { mem8 } = m;
  const sector = ((mem8[PLAYER_HEADING] + STEPS_PER_SECTOR / 2) & 0xff) >> 3;
  mem8[ATTRIBUTE_CELL] = mem8[SHAPE_BY_SECTOR + sector];
  mem8[SHAPE_CELL] = mem8[SHAPE_BY_SECTOR + sector + SECTORS];
}

/** Each twin's exact catch count over the 256 crafted directions. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["no-rounding", brokenNoRounding, 128],
  ["rounds-up", brokenRoundsUp, 96],
  ["table-off-by-one", brokenTableOffByOne, 256],
  ["second-table-gap", brokenSecondTableGap, 32],
  ["shape-only", brokenShapeOnly, 256],
  ["swaps-cells", brokenSwapsCells, 256],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: dressPlayerSpriteForHeading == oracle outside the scratch window", { skip }, () => {
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  dressPlayerSpriteForHeading(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  const window = allDiffs(a, b).map((d) => d.addr);
  assert.ok(window.every((addr) => inScratch(addr, sp)), "a diff sits outside the window");
  console.log(`  EQUAL: sp=${hex4(sp)}; ${window.length} byte(s) differ, all inside the window`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(0x37));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  dressPlayerSpriteForHeading(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  assert.ok(EXCLUDED.includes("ix"), "the dropped index register must stay declared");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real session replays identically", { skip }, () => {
  const r = replay(dressPlayerSpriteForHeading);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  assert.deepEqual([...r.directions], REAL_DIRECTIONS, "the session's direction set moved, so " +
    "the hole this file records about real coverage has to be re-derived");
  console.log(`  CORPUS: ${r.dispatches} dispatches, all at direction ${[...r.directions]}`);
});

test("EXHAUSTIVE: all 256 crafted directions behave as the oracle", { skip }, () => {
  assert.equal(sweepCaught(dressPlayerSpriteForHeading), 0, "the rewrite diverged somewhere in the crafted space");
  const shapes = new Set();
  for (const d of DIRECTIONS) {
    const m = craft(d);
    dressPlayerSpriteForHeading(m);
    shapes.add(m.mem8[SHAPE_CELL]);
  }
  assert.ok(shapes.size > 1, "vacuous: every direction produced the same shape");
  console.log(`  EXHAUSTIVE: ${DIRECTIONS.length} directions identical, ${shapes.size} shapes seen`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of directions`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${DIRECTIONS.length} directions`);
  });
}
