// SPDX-License-Identifier: GPL-3.0-only
/**
 * applyEraRungSettings — memory-equivalent to the frozen oracle at ROM 0x1A9A.
 *
 * GATE: strict unit-capture at a real dispatch — reached by an UNDRIVEN attract run rather than by
 *   the shared tape, which is asserted below — plus a crafted sweep over the two cells that pick
 *   the row. Holes stated:
 *
 *   1. REACHED, and only by attract inside a longer budget — both asserted, so the choice of tape
 *      cannot quietly become "we never reached it".
 *   2. EQUAL at the real dispatch — everything outside a four-byte dead scratch window below the
 *      entry stack pointer. Pinned by every arm.
 *   3. NOT VACUOUS — a candidate that does nothing is caught at the same dispatch, on a real cell.
 *   4. IT SCATTERS TWELVE CELLS, measured: the frozen routine's write set at the real dispatch is
 *      compared against the twelve addresses this file names, so a rewrite that wrote eleven of
 *      them, or wrote a thirteenth, is caught by the arm rather than by luck.
 *   5. CROSS — the era cell against the rung cell, over the whole range each can hold, poked
 *      identically on both sides. Rows past the end of the table are included and are what covers
 *      the eight-bit wrap of the composite number.
 *   6. THE ROW REALLY CHANGES, asserted: the twelve bytes are shown to differ between two rows, so
 *      a rewrite that always read row zero could not pass the cross by accident.
 *   7. TEETH — seven twins, each caught on its own exact count over the cross.
 *
 * HOLE: no twin attacks the era's low nibble being taken rather than the whole byte, and none can:
 * scaling by sixteen and truncating to a byte discards the high nibble anyway, so the two readings
 * are the same function and a twin written for it would be caught zero times and read as coverage.
 *
 * HOLE: nothing here says what the twelve cells DO. The gate fixes which row is chosen and where
 * each of its bytes lands.
 * HOLE: the cross reads a row ADDRESS out of the table for every composite number, including
 * numbers past the table's own end. Those rows are whatever the image holds there; both sides read
 * the same bytes, so the comparison stands, but no claim is made that the game ever asks for them.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1a9a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { applyEraRungSettings } from "../applyEraRungSettings.js";
import { loc_1a9a as oracle } from "../../translated/loc_1a9a.js";
import { ERA_INDEX, ERA_RUNG } from "../names.js";
import { fetchTableWord } from "../fetchTableWord.js";
import { u8, u16 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x1a9a;

const ROW_TABLE = 0x1b04;
const ROWS_PER_ERA = 16;

/** The twelve cells the row is scattered over, in the order the row supplies its ten bytes. */
const DESTINATIONS = [
  [0xa844], [0xa837], [0xa827], [0xa817, 0xa814], [0xacc1],
  [0xacc4], [0xa8c6], [0xa8d6], [0xa8e6], [0xa8f4, 0xa8f6],
];
const CELLS = DESTINATIONS.flat();

const SCRATCH_BYTES = 4;

/** Registers the rewrite may leave diverged: none of these outlives the entry. */
const EXCLUDED = ["a", "f", "b", "e", "sp"];

/** The attract run this entry is reached by, and the frame it is first reached on. Measured. */
const ATTRACT_FRAMES = 2000;
const FIRST_DISPATCH = 1782;
const DISPATCHES = 1;

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function outsideScratch(a, b, sp) {
  return allDiffs(a, b).filter((d) => d.addr < sp - SCRATCH_BYTES || d.addr >= sp);
}

function compare(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return outsideScratch(a, b, sp)[0] ?? null;
}

let captured = null;
let firstFrame = null;
let dispatchCount = 0;

function capture() {
  if (captured !== null) return captured;
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatchCount++;
      if (captured === null) {
        captured = mm.clone();
        firstFrame = mm.frames.length;
      }
      return oracle(mm);
    }]]),
    { tape: [] },
  );
  m.runFrames(ATTRACT_FRAMES);
  assert.equal(m.stoppedBy, null, `attract run stopped early: ${m.stoppedBy}`);
  return captured;
}

function entryState() {
  const e = capture();
  assert.notEqual(e, null, "vacuous: the attract run never reached the routine");
  return e;
}

function craft(era, rung) {
  const m = entryState().clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[ERA_RUNG] = rung;
  return m;
}

const ERAS = [0, 1, 2, 3, 4, 5, 15, 16, 255];
const RUNGS = [0, 1, 2, 7, 15, 16, 128, 254, 255];
const CROSS_SIZE = ERAS.length * RUNGS.length;

function eachCrossEntry(body) {
  for (const era of ERAS) {
    for (const rung of RUNGS) body(era, rung);
  }
}

function crossCaught(candidate) {
  let caught = 0;
  eachCrossEntry((era, rung) => {
    if (compare(candidate, craft(era, rung))) caught++;
  });
  return caught;
}

/** The twelve bytes the frozen routine leaves behind for one era and rung. */
function scattered(era, rung) {
  const m = craft(era, rung);
  oracle(m);
  return CELLS.map((cell) => m.mem8[cell]);
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHED, and only by the undriven attract run", { skip }, () => {
  const entry = entryState();
  assert.equal(dispatchCount, DISPATCHES, "the dispatch count on the attract run moved");
  assert.equal(firstFrame, FIRST_DISPATCH, "the frame it is first reached on moved");
  let onShared = 0;
  const shared = makeMachine(new Map([[TARGET, (mm) => (onShared++, oracle(mm))]]));
  shared.runFrames(ENTRY_FRAMES);
  assert.equal(onShared, 0, "the shared tape now reaches it, so this gate should use that instead");
  console.log(
    `  REACHED: ${dispatchCount} dispatch at frame ${firstFrame} in attract, ${onShared} on the ` +
      `shared tape; era ${entry.mem8[ERA_INDEX]}, rung ${entry.mem8[ERA_RUNG]}`,
  );
});

test("EQUAL at the real dispatch: identical outside the scratch window", { skip }, () => {
  const entry = entryState();
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  applyEraRungSettings(b);
  assert.deepEqual(
    outsideScratch(a, b, sp),
    [],
    `a divergence escaped the scratch window — ${show(outsideScratch(a, b, sp)[0])}`,
  );
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set, which holds only registers that do not " +
      "outlive the entry",
  );
  console.log(`  EQUAL: sp ${hex4(sp)}; identical outside [SP-${SCRATCH_BYTES}, SP)`);
});

test("NOT VACUOUS: a candidate that does nothing is caught on a real cell", { skip }, () => {
  const d = compare(() => {}, entryState());
  assert.notEqual(d, null, "the masked diff passed a no-op, so memory is NOT the gate here");
  assert.ok(CELLS.includes(d.addr), `the no-op is caught at ${hex4(d.addr)}, not on a scattered cell`);
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("IT SCATTERS TWELVE CELLS: the write set is exactly the ones named here", { skip }, () => {
  const seen = new Set();
  eachCrossEntry((era, rung) => {
    const before = craft(era, rung);
    const after = before.clone();
    oracle(after);
    for (const d of allDiffs(before, after)) {
      if (d.addr >= before.regs.sp - SCRATCH_BYTES && d.addr < before.regs.sp) continue;
      seen.add(d.addr);
    }
  });
  const strays = [...seen].filter((addr) => !CELLS.includes(addr));
  assert.deepEqual(strays.map(hex4), [], "it wrote outside the twelve cells this file names");
  assert.ok(seen.size > 1, "vacuous: the cross moved at most one cell");
  console.log(`  WRITE SET: ${seen.size} of the ${CELLS.length} named cells ever moved, none outside`);
});

test("CROSS: era x rung, past the table's end included", { skip }, () => {
  eachCrossEntry((era, rung) => {
    const d = compare(applyEraRungSettings, craft(era, rung));
    assert.equal(d, null, `era=${era} rung=${rung}: ${show(d)}`);
  });
  console.log(`  CROSS: ${CROSS_SIZE} era x rung combinations identical`);
});

test("THE ROW REALLY CHANGES with both halves of the composite number", { skip }, () => {
  const base = scattered(0, 0);
  assert.notDeepEqual(scattered(0, 1), base, "the rung no longer selects a different row");
  assert.notDeepEqual(scattered(1, 0), base, "the era no longer selects a different row");
  assert.deepEqual(
    scattered(ROWS_PER_ERA, 0),
    base,
    "the era's low nibble is no longer all that is used, so the composite number's shape moved",
  );
  console.log("  ROW: both halves of the composite number change the twelve bytes");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

function scatter(m, o) {
  const { mem8, regs } = m;
  const era = mem8[ERA_INDEX];
  const rung = mem8[ERA_RUNG];
  regs.a = u8((o.scale ?? ROWS_PER_ERA) * (era % ROWS_PER_ERA) + rung);
  regs.hl = o.table ?? ROW_TABLE;
  let source = fetchTableWord(m);
  for (const cells of o.destinations ?? DESTINATIONS) {
    const value = mem8[source];
    for (const cell of cells) mem8[cell] = value;
    source = u16(source + 1);
  }
}

const SWAPPED = DESTINATIONS.map((cells, i) =>
  i === 0 ? DESTINATIONS[1] : i === 1 ? DESTINATIONS[0] : cells,
);
const ONE_SHORT = DESTINATIONS.slice(0, DESTINATIONS.length - 1);
const SINGLED = DESTINATIONS.map((cells) => [cells[0]]);

const TWINS = [
  ["no-op", () => {}, 81],
  ["era-not-shifted", (m) => scatter(m, { scale: 1 }), 63],
  ["era-shifted-too-far", (m) => scatter(m, { scale: 32 }), 63],
  ["table-off-by-one", (m) => scatter(m, { table: ROW_TABLE + 2 }), 81],
  ["first-two-swapped", (m) => scatter(m, { destinations: SWAPPED }), 80],
  ["one-byte-short", (m) => scatter(m, { destinations: ONE_SHORT }), 81],
  ["doubles-dropped", (m) => scatter(m, { destinations: SINGLED }), 74],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the cross`, { skip }, () => {
    assert.equal(crossCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${CROSS_SIZE} cross entries`);
  });
}
