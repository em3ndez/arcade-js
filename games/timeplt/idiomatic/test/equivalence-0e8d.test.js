// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSlotWithOneGlyph — memory-equivalent to the frozen oracle at ROM 0x0E8D.
 *
 * GATE: unit-capture judged by a MASKED RAM diff, plus a replayed corpus, plus a crafted sweep of
 *   the routine's three live-in registers, plus a declared live-out comparison, plus teeth.
 *
 *   THE ONE EXCLUSION is the dead stack scratch: the frozen routine reaches the cursor step
 *   through a call, so the two bytes just below the entry stack pointer can hold that call's
 *   return slot, and the rewrite models no stack. The window is exactly [SP-2, SP) and every arm
 *   PINS it — each walks the whole dump and asserts no divergence escapes it.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — identical outside that two-byte window.
 *   2. NOT VACUOUS — a candidate that does nothing FAILS the same masked comparison.
 *   3. CORPUS — every dispatch of a driven and an undriven session, counts asserted, with the
 *      cursors, glyphs and colours real play presents asserted as sets.
 *   4. LIVE-OUT — the stepped cursor is compared explicitly, because the caller draws the next
 *      line from it without reloading. The twin that drops it is caught HERE and nowhere else,
 *      which the arm measures rather than claims.
 *   5. EXCLUDED — the register divergence pinned to a measured set.
 *   6. EXHAUSTIVE — the glyph and the colour swept over their whole 0..255 at a real cursor, and
 *      a cursor family that includes THE EDGE CASE: a cursor sitting on the first cell of the
 *      character plane, where the cell one place along lies in the other plane already and
 *      coming back is a SET rather than an undo. One twin exists only to be caught there.
 *   7. TEETH — seven twins, each caught on an exact count of crafted entries. Four of them score
 *      BELOW the total, and that is the arm reporting its own holes rather than a weakness: the
 *      undo twin is right everywhere but the plane edge, and the blank-the-wrong-neighbour twin
 *      is invisible wherever the glyph it displaces is the blank code itself.
 *
 * HOLE: the cursor family is a chosen set, not a sweep of all 65536 — a cursor outside the two
 * planes writes into the program image and BOTH sides throw, so most of the space is not
 * comparable. The family covers both planes, both page edges and the fourteen cursors real play
 * uses, and the corpus arm asserts that set has not moved.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0e8d.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { drawSlotWithOneGlyph } from "../drawSlotWithOneGlyph.js";
import { loc_0e8d as oracle } from "../../translated/loc_0e8d.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x0e8d;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const SCRATCH_BYTES = 2;
const COLOUR_PLANE_BIT = 0x0400;
const BLANK = 0xf1;
const ONE_LINE_ON = 32;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 56, attract: 14 };
/** The cursors, glyphs and colours real play presents. Measured, and asserted as sets. */
const REAL_CURSORS = [
  0xa463, 0xa483, 0xa4a3, 0xa4c3, 0xa4e3, 0xa503, 0xa523,
  0xa543, 0xa563, 0xa583, 0xa5a3, 0xa5c3, 0xa5e3, 0xa603,
];
const REAL_GLYPHS = [0x01, 0xf1];
const REAL_COLOURS = [0x10, 0x13];

/** A cursor on the plane's first cell: the neighbour is in the OTHER plane already. */
const PLANE_EDGE = 0xa400;

const EXCLUDED = ["a", "f", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry, and the masked comparison ────────────────────────────────────────────────

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
  if (entry === null) gate(drawSlotWithOneGlyph);
  return entry;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Masked RAM first, then the stepped cursor. A candidate that dies is a divergence too. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "survived", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.de !== b.regs.de) return { addr: null, a: a.regs.de, b: b.regs.de };
  return null;
}

function craft(cursor, glyph, colour) {
  const m = entryState().clone();
  m.regs.de = cursor;
  m.regs.b = glyph;
  m.regs.c = colour;
  return m;
}

const CURSOR_FAMILY = [
  PLANE_EDGE, PLANE_EDGE + 1, 0xa41f, 0xa4ff, 0xa500, 0xa7ff,
  0xa001, 0xa100, 0xa200, 0xa3ff, ...REAL_CURSORS,
];

function craftedPoints() {
  const points = [];
  for (const cursor of CURSOR_FAMILY) {
    for (const glyph of [0x00, 0x01, BLANK, 0xff]) {
      for (const colour of [0x00, 0x10, 0x13, 0xff]) points.push([cursor, glyph, colour]);
    }
  }
  for (let v = 0; v < 256; v++) points.push([REAL_CURSORS[0], v, 255 - v]);
  return points;
}

const POINTS = craftedPoints();

function sweepCaught(candidate) {
  let caught = 0;
  for (const [cursor, glyph, colour] of POINTS) {
    if (unitDiff(candidate, craft(cursor, glyph, colour))) caught++;
  }
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const cursors = new Set();
  const glyphs = new Set();
  const colours = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      cursors.add(mm.regs.de);
      glyphs.add(mm.regs.b);
      colours.add(mm.regs.c);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, cursors, glyphs, colours };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, drawSlotWithOneGlyph) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the glyph and the blank go to each other's cell. */
function brokenSwapsTheCells(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = BLANK;
  mem8[neighbour] = regs.b;
  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  const colourOfCell = u16(colourOfNeighbour + 1);
  mem8[colourOfCell] = regs.c;
  regs.de = u16((colourOfCell | COLOUR_PLANE_BIT) + ONE_LINE_ON);
}

/** BUG: only one of the two cells is given the colour. */
function brokenColoursOneCell(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = regs.b;
  mem8[neighbour] = BLANK;
  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  regs.de = u16((u16(colourOfNeighbour + 1) | COLOUR_PLANE_BIT) + ONE_LINE_ON);
}

/**
 * BUG: comes back from the colour plane by SUBTRACTING the plane offset instead of setting the
 * bit. Identical everywhere the cursor was on the character plane to begin with, and wrong at
 * the plane edge — which is the whole reason the cursor family carries that entry.
 */
function brokenUndoesInsteadOfSetting(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = regs.b;
  mem8[neighbour] = BLANK;
  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  const colourOfCell = u16(colourOfNeighbour + 1);
  mem8[colourOfCell] = regs.c;
  regs.de = u16(colourOfCell + COLOUR_PLANE_BIT + ONE_LINE_ON);
}

/** BUG: the cells land right and the cursor is left where it started. */
function brokenDropsTheCursor(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = regs.b;
  mem8[neighbour] = BLANK;
  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  mem8[u16(colourOfNeighbour + 1)] = regs.c;
}

/** BUG: the cursor steps the other way along the plane. */
function brokenStepsBackwards(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = regs.b;
  mem8[neighbour] = BLANK;
  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  const colourOfCell = u16(colourOfNeighbour + 1);
  mem8[colourOfCell] = regs.c;
  regs.de = u16((colourOfCell | COLOUR_PLANE_BIT) - ONE_LINE_ON);
}

/** BUG: blanks the cell one place the OTHER way. */
function brokenBlanksTheWrongNeighbour(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = regs.b;
  mem8[u16(cell + 1)] = BLANK;
  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  const colourOfCell = u16(colourOfNeighbour + 1);
  mem8[colourOfCell] = regs.c;
  regs.de = u16((colourOfCell | COLOUR_PLANE_BIT) + ONE_LINE_ON);
}

const TWINS = [
  ["no-op", brokenNoOp, 640],
  ["swaps-the-cells", brokenSwapsTheCells, 483],
  ["colours-one-cell", brokenColoursOneCell, 553],
  ["undoes-instead-of-setting", brokenUndoesInsteadOfSetting, 16],
  ["drops-the-cursor", brokenDropsTheCursor, 640],
  ["steps-backwards", brokenStepsBackwards, 640],
  ["blanks-the-wrong-neighbour", brokenBlanksTheWrongNeighbour, 64],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the two-byte scratch window", { skip }, () => {
  gate(drawSlotWithOneGlyph);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  drawSlotWithOneGlyph(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.de, b.regs.de, "the stepped cursor diverged");
  console.log(
    `  EQUAL: entry cursor=${hex4(entryState().regs.de)} glyph=${entryState().regs.b} ` +
      `colour=${entryState().regs.c} sp=${hex4(sp)}`,
  );
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same masked comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed an empty candidate, so it measures nothing here");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell, not on the cursor alone");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CORPUS: every dispatch of two whole sessions replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.deepEqual([...s.cursors].sort((x, y) => x - y), REAL_CURSORS,
      `the ${s.label} tape's cursor set moved, so the crafted family covers the wrong holes`);
    assert.deepEqual([...s.glyphs].sort((x, y) => x - y), REAL_GLYPHS, `${s.label} glyph set moved`);
    assert.deepEqual([...s.colours].sort((x, y) => x - y), REAL_COLOURS, `${s.label} colour set moved`);
    total += s.dispatches;
  }
  assert.ok(!REAL_CURSORS.includes(PLANE_EDGE), "real play now reaches the plane edge, so the " +
    "edge twin is no longer crafted-only and this file's account of it must be re-derived");
  console.log(
    `  CORPUS: ${total} dispatches over ${TAPES.length} sessions; ${REAL_CURSORS.length} cursors, ` +
      `${REAL_GLYPHS.length} glyphs, ${REAL_COLOURS.length} colours, none at the plane edge`,
  );
});

test("EXCLUDED, deliberately: registers and pc, and the scratch push", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  drawSlotWithOneGlyph(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape: the cursor is a live-out and must not appear here",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("EXHAUSTIVE: the crafted family, the plane edge included, is identical", { skip }, () => {
  assert.equal(sweepCaught(drawSlotWithOneGlyph), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(
    `  EXHAUSTIVE: ${POINTS.length} crafted entries over ${CURSOR_FAMILY.length} cursors identical`,
  );
});

test("THE EDGE IS LOAD-BEARING: the undo twin is caught ONLY there", { skip }, () => {
  const atEdge = unitDiff(brokenUndoesInsteadOfSetting, craft(PLANE_EDGE, 1, 0x10));
  const away = unitDiff(brokenUndoesInsteadOfSetting, craft(REAL_CURSORS[0], 1, 0x10));
  assert.notEqual(atEdge, null, "the undo twin survives at the plane edge, so the edge entry in " +
    "the cursor family is buying nothing");
  assert.equal(away, null, "the undo twin is caught away from the edge too, so it no longer shows " +
    "that the edge is what discriminates");
  console.log(`  EDGE: caught at ${hex4(PLANE_EDGE)} — ${show(atEdge)}; identical away from it`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${POINTS.length} crafted entries`);
  });
}
