// SPDX-License-Identifier: GPL-3.0-only
/**
 * armLineWipeFromFifthLine — memory-equivalent to the frozen oracle at ROM 0x01B5.
 *
 * GATE: strict unit-capture at the one real dispatch the shared coin -> start tape produces,
 *   plus an image-poke arm and teeth. Four instructions and two destination cells, so the whole
 *   content of the entry is WHICH address and WHICH count land there.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at the real dispatch — the whole state dump is identical, the stack included: this
 *      entry pushes nothing, so the exclusion window is measured at ZERO bytes and asserted so.
 *   2. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   3. EXCLUDED, deliberately — the registers that may differ are bounded by measurement; a
 *      register outside the set fails, and a rewrite that clobbers fewer of them stays green.
 *   4. THE VALUES LAND — both cells are read back after the rewrite runs and checked against the
 *      program image, so the RAM arm is demonstrably not vacuous on the two cells that matter.
 *   5. IT READS THE IMAGE — a twin that bakes the count in as a constant is byte-identical on an
 *      untouched image, so the count byte is POKED and both sides re-run: the rewrite must follow
 *      the poke and the baked twin must not. That twin's blindness without the poke is asserted,
 *      so its agreement is never read as reassurance.
 *   6. TEETH — six twins, each caught, and each asserted for WHICH arm catches it.
 *
 * HOLE: THE CORPUS IS ONE DISPATCH. This entry fires exactly once in 600 frames of the shared
 * tape and takes no input at all, so there is nothing to sweep and no second state to compare;
 * the crafted arm here is the image poke, not a range of entry states.
 * HOLE: nothing here says what consumes the two cells. The gate fixes the pair that is written
 * and claims nothing about the wipe that reads it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-01b5.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { armLineWipeFromFifthLine } from "../armLineWipeFromFifthLine.js";
import { loc_01b5 as oracle } from "../../translated/loc_01b5.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR } from "../names.js";

const TARGET = 0x01b5;
const FRAMES = 600;
const DISPATCHES = 1;

const FIRST_CELL = 0xa404;
const COLUMN_COUNT_SOURCE = 0x0ccd;

/** Measured: the entry pushes nothing, so no byte below the stack pointer may differ. */
const SCRATCH_BYTES = 0;
const EXCLUDED = ["a", "h", "l", "sp"];

const POKED_COUNT = 0x5e;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

/** Every differing byte of two state dumps, as {addr, a, b}. */
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

/** Oracle against candidate on two clones of one machine, masked by the scratch window. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

let entry = null;

/** Replay a whole session, comparing the candidate against the oracle at EVERY dispatch. */
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
  if (entry === null) replay(armLineWipeFromFifthLine);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** Run `body` with one program-image byte forced, then put it back whatever happens. */
function withPokedImage(m, addr, value, body) {
  const image = m.mem.rom;
  const was = image[addr];
  image[addr] = value;
  try {
    return body();
  } finally {
    image[addr] = was;
  }
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: starts the wipe at the very first cell instead of four cells in. */
function brokenFirstCell(m) {
  m.mem16[BLANK_LINE_CURSOR] = 0xa400;
  m.mem8[BLANK_LINES_LEFT] = m.mem8[COLUMN_COUNT_SOURCE];
}

/** BUG: bakes the count in as a constant instead of reading it out of the image. */
function brokenBakedCount(m) {
  m.mem16[BLANK_LINE_CURSOR] = FIRST_CELL;
  m.mem8[BLANK_LINES_LEFT] = 0x1b;
}

/** BUG: one column short. */
function brokenCountOffByOne(m) {
  m.mem16[BLANK_LINE_CURSOR] = FIRST_CELL;
  m.mem8[BLANK_LINES_LEFT] = m.mem8[COLUMN_COUNT_SOURCE] - 1;
}

/** BUG: stages the address and forgets the count. */
function brokenCursorOnly(m) {
  m.mem16[BLANK_LINE_CURSOR] = FIRST_CELL;
}

/** BUG: stages the count and forgets the address. */
function brokenCountOnly(m) {
  m.mem8[BLANK_LINES_LEFT] = m.mem8[COLUMN_COUNT_SOURCE];
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["wrong-first-cell", brokenFirstCell],
  ["baked-count", brokenBakedCount],
  ["count-off-by-one", brokenCountOffByOne],
  ["cursor-only", brokenCursorOnly],
  ["count-only", brokenCountOnly],
];

/** The twins a run on an UNTOUCHED image can tell apart. The baked one is invisible there. */
const CAUGHT_UNPOKED = TWINS.filter(([label]) => label !== "baked-count").map(([label]) => label);

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: armLineWipeFromFifthLine == oracle over the whole dump", { skip }, () => {
  const r = replay(armLineWipeFromFifthLine);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged at a real dispatch");

  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  armLineWipeFromFifthLine(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: ${r.dispatches} dispatch, sp=${hex4(sp)}, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a bounded register set, and nothing outside it", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  armLineWipeFromFifthLine(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved.filter((k) => !EXCLUDED.includes(k)),
    [],
    "a register outside the declared excluded set diverged",
  );
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("THE VALUES LAND: both staged cells hold what the image says", { skip }, () => {
  const m = entryState().clone();
  armLineWipeFromFifthLine(m);
  assert.equal(m.mem16[BLANK_LINE_CURSOR], FIRST_CELL, "the start cell");
  assert.equal(m.mem8[BLANK_LINES_LEFT], m.mem8[COLUMN_COUNT_SOURCE], "the column count");
  assert.notEqual(m.mem8[COLUMN_COUNT_SOURCE], 0, "vacuous: the count in the image is zero");
  console.log(
    `  LANDS: ${hex4(BLANK_LINE_CURSOR)}=${hex4(m.mem16[BLANK_LINE_CURSOR])} ` +
      `${hex4(BLANK_LINES_LEFT)}=${m.mem8[BLANK_LINES_LEFT]}`,
  );
});

test("IT READS THE IMAGE: the count follows a poke and a baked constant does not", { skip }, () => {
  const base = entryState();
  assert.equal(unitDiff(brokenBakedCount, base), null, "the baked twin must be invisible here");

  const followed = withPokedImage(base, COLUMN_COUNT_SOURCE, POKED_COUNT, () => {
    const m = base.clone();
    armLineWipeFromFifthLine(m);
    return m.mem8[BLANK_LINES_LEFT];
  });
  assert.equal(followed, POKED_COUNT, "the rewrite baked the count in instead of reading it");

  const caught = withPokedImage(base, COLUMN_COUNT_SOURCE, POKED_COUNT, () =>
    unitDiff(brokenBakedCount, base));
  assert.notEqual(caught, null, "with the image poked, the baked twin must be caught");
  console.log(`  IMAGE: poked to ${POKED_COUNT}; rewrite follows, baked twin caught — ${show(caught)}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is caught, or is recorded blind`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    const expected = CAUGHT_UNPOKED.includes(label);
    assert.equal(d !== null, expected, `the ${label} twin's verdict changed`);
    console.log(`  TEETH/${label}: ${expected ? `caught — ${show(d)}` : "BLIND here, as recorded"}`);
  });
}
