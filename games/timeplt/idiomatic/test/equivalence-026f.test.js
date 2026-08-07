// SPDX-License-Identifier: GPL-3.0-only
/**
 * plotPenCell — memory-equivalent to the frozen oracle at ROM 0x026F.
 *
 * GATE: strict unit-capture — no exclusion of any kind, not even a stack window, because the
 *   frozen routine pushes nothing and the whole state dump compares byte-identical. On top of
 *   that a crafted sweep of the routine's entire input space, and teeth.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — the whole dump, stack included.
 *   2. NOT VACUOUS — a candidate that does nothing FAILS the same comparison, so the captured
 *      entry really does have both writes visible in it.
 *   3. CORPUS — every dispatch of two whole sessions, driven and undriven, replayed one at a
 *      time. The dispatch counts are measured and asserted, so a move is a finding.
 *   4. EXCLUDED — the register divergence is pinned to a set derived from the ORACLE: only the
 *      flags and SP, because HL and A are LIVE-OUT here. pc moves because the frozen routine
 *      returns and the rewrite does not. A twin that drops the returned address is asserted
 *      caught, and the memory sweep is asserted BLIND to it in the same arm.
 *   5. EXHAUSTIVE — the routine reads exactly four cells and writes two, so its input space IS
 *      those four bytes. Both coordinates are swept over the full 0..255 against each other in
 *      step, crossed, and against a fixed partner, and the glyph and colour bytes are swept too.
 *      The two FOLDS are what this arm is for: a row past the thirty-second, and a column that
 *      carries out of the low half of the address.
 *   6. TEETH — five twins, each caught, with the exact number of sweep points it is caught on.
 *
 * HOLE: one captured backdrop. Everything except the four swept bytes is whatever the session
 * left, which cannot matter here because nothing else is read — but the two cells written are
 * plane cells, so a twin that writes to the RIGHT cell with the RIGHT byte is invisible, and
 * that is what the twin list is chosen to cover rather than the backdrop.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-026f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { plotPenCell } from "../plotPenCell.js";
import { loc_026f as oracle } from "../../translated/loc_026f.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8 } from "../../../../core/int.js";

const TARGET = 0x026f;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const PLOT_ROW = 0xa9e4;
const PLOT_COLUMN = 0xa9e6;
const GLYPH = 0xad0b;
const COLOUR = 0xad0c;
const CHARACTER_PLANE = 0xa400;
const COLOUR_PLANE_BIT = 0x0400;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 1775, attract: 1775 };

/**
 * Derived from the ORACLE, not from the module. The frozen routine ends `set 2,h`, which exists
 * for no reason but to hand HL back on the video plane, and it leaves the colour in A -- so HL and
 * A are LIVE-OUT and a rewrite that drops them is broken. What legitimately diverges is the flag
 * byte, which no rewrite models, and SP, because the frozen routine returns and the rewrite does
 * not.
 */
const EXCLUDED = ["f", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(plotPenCell);
  return entry;
}

/** Every differing byte of two dumps. No window is excluded; this routine pushes nothing. */
function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b)[0] ?? null;
}

/** A real captured machine with the four bytes this routine reads forced. */
function craft(row, column, glyph, colour) {
  const m = entryState().clone();
  m.mem8[PLOT_ROW] = row;
  m.mem8[PLOT_COLUMN] = column;
  m.mem8[GLYPH] = glyph;
  m.mem8[COLOUR] = colour;
  return m;
}

/** Points chosen to hit both folds: rows past the plane, and columns that carry. */
function sweepPoints() {
  const points = [];
  for (let v = 0; v < 256; v++) {
    points.push([v, 0x1f, 0x41, 0x07]);
    points.push([v, v, 0x42, 0x08]);
    points.push([v, 255 - v, 0x43, 0x09]);
    points.push([0x0d, v, 0x44, 0x0a]);
    points.push([v, 0xff, v, u8(255 - v)]);
  }
  return points;
}

const POINTS = sweepPoints();

function sweepCaught(candidate) {
  let caught = 0;
  for (const [row, column, glyph, colour] of POINTS) {
    if (unitDiff(candidate, craft(row, column, glyph, colour))) caught++;
  }
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const rows = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      rows.add(mm.mem8[PLOT_ROW]);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, rows };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, plotPenCell) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the row is scaled at full width, so a row past the plane runs on instead of folding. */
function brokenRowDoesNotFold(m) {
  const { mem8 } = m;
  const rowStart = mem8[PLOT_ROW] * 32;
  const cell = (CHARACTER_PLANE + (rowStart & 0xff00)) | u8(rowStart + mem8[PLOT_COLUMN]);
  mem8[cell] = mem8[GLYPH];
  mem8[cell & ~COLOUR_PLANE_BIT] = mem8[COLOUR];
}

/** BUG: the column is added to the whole address, so it carries into the next row. */
function brokenColumnCarries(m) {
  const { mem8 } = m;
  const rowStart = (mem8[PLOT_ROW] & 31) * 32;
  const cell = CHARACTER_PLANE + rowStart + mem8[PLOT_COLUMN];
  mem8[cell] = mem8[GLYPH];
  mem8[cell & ~COLOUR_PLANE_BIT] = mem8[COLOUR];
}

/** BUG: the colour never reaches the colour plane, so the glyph is written twice. */
function brokenColourStaysOnThePlane(m) {
  const { mem8 } = m;
  const rowStart = (mem8[PLOT_ROW] & 31) * 32;
  const cell = (CHARACTER_PLANE + (rowStart & 0xff00)) | u8(rowStart + mem8[PLOT_COLUMN]);
  mem8[cell] = mem8[GLYPH];
  mem8[cell] = mem8[COLOUR];
}

/** BUG: the two source cells are read the other way round. */
function brokenSwapsSources(m) {
  const { mem8 } = m;
  const rowStart = (mem8[PLOT_ROW] & 31) * 32;
  const cell = (CHARACTER_PLANE + (rowStart & 0xff00)) | u8(rowStart + mem8[PLOT_COLUMN]);
  mem8[cell] = mem8[COLOUR];
  mem8[cell & ~COLOUR_PLANE_BIT] = mem8[GLYPH];
}

/** BUG: writes both cells correctly but drops the address the caller steps a run with. The
 *  memory sweep is BLIND to this -- every byte it writes is right -- which is why it gets a
 *  register arm of its own rather than a row in TWINS. */
function brokenDropsReturnedAddress(m) {
  const { mem8 } = m;
  const rowStart = (mem8[PLOT_ROW] & 31) * 32;
  const cell = (CHARACTER_PLANE + (rowStart & 0xff00)) | u8(rowStart + mem8[PLOT_COLUMN]);
  mem8[cell] = mem8[GLYPH];
  mem8[cell & ~COLOUR_PLANE_BIT] = mem8[COLOUR];
}

const TWINS = [
  ["no-op", brokenNoOp, 1280],
  ["row-does-not-fold", brokenRowDoesNotFold, 896],
  ["column-carries", brokenColumnCarries, 608],
  ["colour-stays-on-the-plane", brokenColourStaysOnThePlane, 1280],
  ["swaps-sources", brokenSwapsSources, 1280],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: the whole dump, stack included", { skip }, () => {
  const r = gate(plotPenCell);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `a byte diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  EQUAL: entry row=${e.mem8[PLOT_ROW]} column=${e.mem8[PLOT_COLUMN]} ` +
      `glyph=${e.mem8[GLYPH]} colour=${e.mem8[COLOUR]}; identical`,
  );
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the comparison passed an empty candidate, so it measures nothing here");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CORPUS: every dispatch of two whole sessions replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  console.log(
    `  CORPUS: ${total} dispatches over ${TAPES.length} sessions, identical on each; rows seen ` +
      sessions().map((s) => `${s.label} ${s.rows.size}`).join(", "),
  );
});

test("EXCLUDED, deliberately: only the flags and SP, and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  plotPenCell(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("TEETH: a rewrite that drops the returned address is CAUGHT, and the memory sweep is BLIND to it", { skip }, () => {
  // The blindness first, so the arm below is not mistaken for redundancy: every byte this twin
  // writes is correct, so the exhaustive MEMORY sweep passes it.
  assert.equal(
    sweepCaught(brokenDropsReturnedAddress),
    0,
    "the memory sweep now catches this twin, so this arm is no longer the only thing that does",
  );

  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenDropsReturnedAddress(b);
  const diverged = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  for (const reg of ["h", "l", "a"]) {
    assert.ok(diverged.includes(reg), `the twin left ${reg} matching the oracle, so it is not the twin this arm needs`);
  }
  console.log(`  TEETH/drops-returned-address: memory sweep BLIND, register arm caught ${diverged.join(", ")}`);
});

test("EXHAUSTIVE: both coordinates over their whole range, including both folds", { skip }, () => {
  assert.equal(sweepCaught(plotPenCell), 0, "the rewrite diverged somewhere in the crafted space");
  const folds = POINTS.filter(([row]) => row > 31).length;
  assert.ok(folds > 0, "vacuous: no swept point reaches a row past the plane");
  console.log(`  EXHAUSTIVE: ${POINTS.length} crafted points identical, ${folds} of them folding`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted points`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${POINTS.length} crafted points`);
  });
}
