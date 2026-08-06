// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0bff — memory-equivalent to the frozen oracle at ROM 0x0BFF.
 *
 * GATE: unit-capture at the real first dispatch through unitEquivalence, widened to a REPLAY of
 *   EVERY dispatch the coin -> start tape produces, plus four crafted entries for arms the tape
 *   does not present.
 *
 * THE EXCLUSION WINDOW. The oracle brackets each cursor step with a return address pushed onto
 *   the stack; the rewrite makes that step a JS call and pushes nothing, so two bytes of stack
 *   scratch below the dispatch's own stack pointer differ by construction and `r.ram` is not
 *   null for a CORRECT routine. Those two bytes, and only those two, are excluded — measured
 *   from THIS dispatch's stack pointer, never a constant. At the first dispatch the differing
 *   set is asserted to be EXACTLY that pair; across the corpus it is asserted to be a subset,
 *   because a pushed byte that already held its own value diverges on neither side. Both
 *   bracketing addresses are asserted clean on every dispatch, so the window cannot widen, and
 *   the empty-caption entry pins the other end: no step, no push, no divergence at all.
 *
 * THE FOUR VACUITY FLAVOURS, each answered by an arm rather than by argument:
 *   1. REGISTER-ONLY — it is not. The whole effect is memory, and the no-op twin dies at the
 *      real dispatch and on nearly every captured one. No blind arm is needed.
 *   2. DEAD FIRST DISPATCH — the entry unitEquivalence clones paints eight cells over a blank
 *      tilemap, so arm 1 is a real comparison. Asserted, not assumed: a larger frame budget
 *      could not repair it, since the FIRST entry is the entry that gets cloned.
 *   3. DEGENERATE ENTRY — measured and pinned. The caption is re-painted every frame, so most
 *      dispatches rewrite values already present: a handful change nothing at all, and a twin
 *      that stops painting the character plane after the first cell survives most of the
 *      corpus. The remedy is the blank-canvas crafted entry, where every write is visible and
 *      all six twins die.
 *   4. UNIFORM CORPUS — it is not uniform (many destinations, many colours, run lengths from
 *      four to twenty) and every dispatch is replayed, not merely the first.
 *
 * The painted-cell model in this file is derived here and CHECKED against the other side of the
 * comparison: on the blank canvas the cells it predicts are exactly the cells the oracle moves.
 *
 * HOLES. Only the coin -> start tape's states are replayed; a caption the tape never posts is
 * unseen except through the crafted entries. The crafted entries nudge one register each on a
 * real captured state, identically on both sides.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0bff.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0bff } from "../loc_0bff.js";
import { advanceCharCursor } from "../advanceCharCursor.js";
import { loc_0bff as oracle } from "../../translated/loc_0bff.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x0bff;
const END_OF_TEXT = 185;
const CHARACTER_PLANE_BIT = 0x0400;
const CHARACTER_PLANE = 0xa400;
const CELL_STEP = 32;

const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const list = (addrs) => addrs.slice(0, 8).map(hex4).join(" ") + (addrs.length > 8 ? " …" : "");

// ── the captured corpus ─────────────────────────────────────────────────────────────────────

let captured = null;

/** One driven session, every dispatch cloned on entry, the host left undisturbed. */
function corpus() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  captured = { entries, frames: frames.length, stoppedBy: m.stoppedBy };
  return captured;
}

// ── the comparison every arm shares ─────────────────────────────────────────────────────────

function stackWindow(state) {
  const sp = state.regs.sp;
  return [u16(sp - 2), u16(sp - 1)];
}

/** The two addresses that bracket the window; a widening shows up on one of them. */
function windowEdges(state) {
  const sp = state.regs.sp;
  return [u16(sp - 3), u16(sp)];
}

/** Every RAM address on which the two arms disagree, run from `state` on independent clones. */
function divergences(state, candidate) {
  const a = state.clone();
  const b = state.clone();
  oracle(a);
  candidate(b);
  const left = a.dumpState();
  const right = b.dumpState();
  const out = [];
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) out.push(a.stateOffsetToAddr(i));
  }
  return out;
}

function outsideWindow(state, candidate) {
  const window = stackWindow(state);
  return divergences(state, candidate).filter((addr) => !window.includes(addr));
}

/** Addresses the oracle MOVES from this entry, stack scratch aside — its real footprint. */
function footprint(state) {
  const before = state.dumpState();
  const a = state.clone();
  oracle(a);
  const after = a.dumpState();
  const window = stackWindow(state);
  const out = [];
  for (let i = 0; i < after.length; i++) {
    if (after[i] === before[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (!window.includes(addr)) out.push(addr);
  }
  return out;
}

function runLength(state) {
  let n = 0;
  let p = state.regs.hl;
  while (state.mem8[p] !== END_OF_TEXT) {
    n++;
    p = u16(p + 1);
  }
  return n;
}

/** The cells a caption reaches: glyph then colour, the cursor snapped back and stepped on. */
function paintedCells(state) {
  const cells = [];
  let cursor = state.regs.de;
  for (let i = 0; i < runLength(state); i++) {
    cells.push(cursor, cursor & ~CHARACTER_PLANE_BIT);
    cursor = u16((cursor | CHARACTER_PLANE_BIT) - CELL_STEP);
  }
  return cells;
}

// ── crafted entries: a real captured state, one register nudged ─────────────────────────────

/** The caption pointer moved onto its own terminator, so the run is empty. */
function craftedEmpty() {
  const s = corpus().entries[0].clone();
  let p = s.regs.hl;
  while (s.mem8[p] !== END_OF_TEXT) p = u16(p + 1);
  s.regs.hl = p;
  return s;
}

/** The cursor arrives on the colour side, which no captured dispatch does. */
function craftedColourSide() {
  const s = corpus().entries[0].clone();
  s.regs.de = s.regs.de & ~CHARACTER_PLANE_BIT;
  return s;
}

/** The cursor starts on the first character cell, so the step falls out of the plane. */
function craftedPlaneCross() {
  const longest = corpus().entries.reduce((a, b) => (runLength(b) > runLength(a) ? b : a));
  const s = longest.clone();
  s.regs.de = CHARACTER_PLANE;
  return s;
}

/** Every cell the caption will reach cleared first, so no write can hide behind a re-paint. */
function craftedBlankCanvas() {
  const s = corpus().entries[0].clone();
  for (const cell of paintedCells(s)) s.mem8[cell] = 0;
  return s;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("WHOLE SESSION: the driven tape runs clean and reaches the routine", { skip }, () => {
  const { entries, frames, stoppedBy } = corpus();
  assert.equal(stoppedBy, null, "the session did not run to completion");
  assert.equal(frames, ENTRY_FRAMES, "the session did not capture every frame");
  assert.ok(entries.length > 0, "vacuous: the tape never reached the routine");
  console.log(`  SESSION: ${frames} frames, clean, ${entries.length} dispatches captured`);
});

test("EQUAL at the real dispatch, stack scratch aside", { skip }, () => {
  let harvested = null;
  const r = unitEquivalence(makeMachine, TARGET, oracle, (m) => {
    if (harvested === null) harvested = m.clone();
    return loc_0bff(m);
  }, { maxFrames: ENTRY_FRAMES });

  assert.notEqual(harvested, null, "vacuous: the routine was never entered");
  assert.deepEqual(
    [...harvested.dumpState()],
    [...corpus().entries[0].dumpState()],
    "the two capture paths disagree about the first dispatch",
  );

  const window = stackWindow(harvested);
  assert.notEqual(r.ram, null, "the oracle's pushed return address must show up here");
  assert.ok(window.includes(r.ram.addr), `RAM diverged off the stack — ${hex4(r.ram.addr)}`);

  const diverged = divergences(harvested, loc_0bff);
  assert.deepEqual(diverged, window, `the differing set must be exactly the pushed word`);
  console.log(`  EQUAL: RAM identical outside ${hex4(window[0])}..${hex4(window[1])}`);
});

test("NOT A DEAD FIRST DISPATCH: the cloned entry paints a real caption", { skip }, () => {
  const first = corpus().entries[0];
  const cells = paintedCells(first);
  assert.ok(runLength(first) > 0, "the first dispatch has an empty caption");
  assert.equal(cells.length, 2 * runLength(first), "two cells per glyph, always");
  assert.ok(footprint(first).length > 0, "the first dispatch changes nothing");
  console.log(
    `  FIRST: ${runLength(first)} glyphs, ${footprint(first).length} cells moved — ${list(cells)}`,
  );
});

test("EXCLUDED, deliberately: three registers and pc move, and nothing else", { skip }, () => {
  const first = corpus().entries[0];
  const a = first.clone();
  const b = first.clone();
  oracle(a);
  loc_0bff(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["a", "f", "sp"], "the excluded set changed shape");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.hl, b.regs.hl, "the caption pointer is reproduced, not excluded");
  assert.equal(a.regs.de, b.regs.de, "the cursor is reproduced, not excluded");
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc; hl and de reproduced`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries } = corpus();
  let moved = 0;
  for (const state of entries) {
    const diverged = outsideWindow(state, loc_0bff);
    assert.deepEqual(diverged, [], `a dispatch diverged — ${list(diverged)}`);
    if (footprint(state).length) moved++;
  }
  assert.equal(entries.length, 287, "the corpus changed size");
  assert.equal(moved, 281, "the informative share of the corpus changed");
  console.log(`  CORPUS: ${entries.length} dispatches identical; ${moved} change RAM at all`);
});

test("THE WINDOW IS MINIMAL: two bytes wide, and both edges stay clean", { skip }, () => {
  const { entries } = corpus();
  let bothBytes = 0;
  for (const state of entries) {
    const diverged = divergences(state, loc_0bff);
    for (const edge of windowEdges(state)) {
      assert.ok(!diverged.includes(edge), `the window widened onto ${hex4(edge)}`);
    }
    if (diverged.length === 2) bothBytes++;
  }
  assert.equal(bothBytes, 245, "the share of dispatches needing the whole window changed");
  console.log(`  WINDOW: never wider than two bytes; ${bothBytes} dispatches need both`);
});

test("NOT A UNIFORM CORPUS: destinations, colours and lengths all vary", { skip }, () => {
  const { entries } = corpus();
  const destinations = new Set(entries.map((s) => s.regs.de));
  const colours = new Set(entries.map((s) => s.regs.c));
  const lengths = entries.map(runLength);
  assert.equal(destinations.size, 17, "the destination spread changed");
  assert.equal(colours.size, 8, "the colour spread changed");
  assert.equal(Math.min(...lengths), 4, "the shortest caption changed");
  assert.equal(Math.max(...lengths), 20, "the longest caption changed");
  console.log(
    `  SPREAD: ${destinations.size} destinations, ${colours.size} colours, ` +
      `captions ${Math.min(...lengths)}..${Math.max(...lengths)} glyphs`,
  );
});

test("CRAFTED: the model's cells are exactly the cells the other arm moves", { skip }, () => {
  const blank = craftedBlankCanvas();
  const predicted = [...new Set(paintedCells(blank))].sort((x, y) => x - y);
  const actual = [...new Set(footprint(blank))].sort((x, y) => x - y);
  assert.deepEqual(actual, predicted, "the painted-cell model does not match the real footprint");
  assert.equal(predicted.length, 16, "the blank canvas footprint changed size");
  assert.deepEqual(outsideWindow(blank, loc_0bff), [], "the blank canvas diverged");
  console.log(`  BLANK: ${predicted.length} cells predicted and moved — ${list(predicted)}`);
});

test("CRAFTED: an empty caption paints nothing at all", { skip }, () => {
  const empty = craftedEmpty();
  assert.equal(runLength(empty), 0, "the crafted entry is not empty");
  assert.equal(footprint(empty).length, 0, "an empty caption must move no cell");
  assert.deepEqual(divergences(empty, loc_0bff), [], "the empty entry diverged");
  console.log("  EMPTY: nothing painted, not even the stack — the run never steps");
});

test("CRAFTED: a cursor arriving on the colour side", { skip }, () => {
  const s = craftedColourSide();
  assert.ok((s.regs.de & CHARACTER_PLANE_BIT) === 0, "the crafted cursor is not on the colour side");
  assert.ok(
    corpus().entries.every((e) => (e.regs.de & CHARACTER_PLANE_BIT) !== 0),
    "the tape reaches this arm after all, so it need not be crafted",
  );
  assert.deepEqual(outsideWindow(s, loc_0bff), [], "the colour-side entry diverged");
  console.log("  COLOUR SIDE: the first glyph is overwritten by its own colour, both sides");
});

test("CRAFTED: the run steps out of the character plane", { skip }, () => {
  const s = craftedPlaneCross();
  const glyphCells = paintedCells(s).filter((_, i) => i % 2 === 0);
  assert.ok(glyphCells.some((c) => c < CHARACTER_PLANE), "the crafted run never leaves the plane");
  assert.deepEqual(outsideWindow(s, loc_0bff), [], "the plane-crossing entry diverged");
  const below = glyphCells.filter((c) => c < CHARACTER_PLANE);
  console.log(`  PLANE CROSS: ${below.length} glyph cell(s) below the plane — ${list(below)}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Six plausible ways to get this routine wrong. Each must be caught by the SAME comparison the
// arms above pass, and each catch count below is measured rather than asserted to be large.

/** BUG: does nothing — the tell that a gate is measuring an unreached or degenerate routine. */
function brokenNoOp() {}

/** BUG: paints the glyph and forgets the colour cell. */
function brokenSkipsColour(m) {
  const { regs, mem8 } = m;
  let nextGlyph = regs.hl;
  for (;;) {
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    mem8[regs.de] = glyph;
    regs.de |= CHARACTER_PLANE_BIT;
    nextGlyph = u16(nextGlyph + 1);
    advanceCharCursor(m);
  }
  regs.hl = nextGlyph;
}

/** BUG: leaves the cursor on the colour side instead of snapping it back. */
function brokenPlaneNotRestored(m) {
  const { regs, mem8 } = m;
  let nextGlyph = regs.hl;
  for (;;) {
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    mem8[regs.de] = glyph;
    regs.de = regs.de & ~CHARACTER_PLANE_BIT;
    mem8[regs.de] = regs.c;
    nextGlyph = u16(nextGlyph + 1);
    advanceCharCursor(m);
  }
  regs.hl = nextGlyph;
}

/** BUG: tests the terminating code after painting it instead of before. */
function brokenPaintsTerminator(m) {
  const { regs, mem8 } = m;
  let nextGlyph = regs.hl;
  for (;;) {
    const glyph = mem8[nextGlyph];
    mem8[regs.de] = glyph;
    mem8[regs.de & ~CHARACTER_PLANE_BIT] = regs.c;
    regs.de |= CHARACTER_PLANE_BIT;
    nextGlyph = u16(nextGlyph + 1);
    advanceCharCursor(m);
    if (glyph === END_OF_TEXT) break;
  }
  regs.hl = nextGlyph;
}

/** BUG: walks the line the other way. */
function brokenStepsBackwards(m) {
  const { regs, mem8 } = m;
  let nextGlyph = regs.hl;
  for (;;) {
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    mem8[regs.de] = glyph;
    mem8[regs.de & ~CHARACTER_PLANE_BIT] = regs.c;
    regs.de = u16((regs.de | CHARACTER_PLANE_BIT) + CELL_STEP);
    nextGlyph = u16(nextGlyph + 1);
  }
  regs.hl = nextGlyph;
}

/** BUG: puts the colour in the character plane, so it lands on the glyph. */
function brokenColourOverGlyph(m) {
  const { regs, mem8 } = m;
  let nextGlyph = regs.hl;
  for (;;) {
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    mem8[regs.de] = glyph;
    mem8[regs.de] = regs.c;
    regs.de |= CHARACTER_PLANE_BIT;
    nextGlyph = u16(nextGlyph + 1);
    advanceCharCursor(m);
  }
  regs.hl = nextGlyph;
}

// [twin, label, dispatches of 287 it is caught on, cells it moves wrongly on the blank canvas]
const TWINS = [
  [brokenNoOp, "no-op", 281, 16],
  [brokenSkipsColour, "skips-the-colour", 278, 8],
  [brokenPlaneNotRestored, "plane-not-restored", 23, 7],
  [brokenPaintsTerminator, "paints-the-terminator", 287, 2],
  [brokenStepsBackwards, "steps-backwards", 287, 28],
  [brokenColourOverGlyph, "colour-over-glyph", 287, 16],
];

for (const [twin, label, corpusCatches, blankCatches] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT at the real dispatch`, { skip }, () => {
    const first = corpus().entries[0];
    const missed = outsideWindow(first, twin);
    assert.ok(missed.length > 0, `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught on ${missed.length} cell(s) — ${list(missed)}`);
  });

  test(`TEETH: the ${label} twin, counted over the corpus`, { skip }, () => {
    let caught = 0;
    for (const state of corpus().entries) if (outsideWindow(state, twin).length) caught++;
    assert.equal(caught, corpusCatches, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${corpus().entries.length} dispatches`);
  });

  test(`TEETH: the ${label} twin dies on the blank canvas`, { skip }, () => {
    const missed = outsideWindow(craftedBlankCanvas(), twin);
    assert.equal(missed.length, blankCatches, `the ${label} twin's blank-canvas footprint moved`);
    console.log(`  TEETH/${label}: blank canvas catches ${missed.length} cell(s)`);
  });
}

test("TEETH: the empty caption discriminates exactly one twin", { skip }, () => {
  const empty = craftedEmpty();
  const caught = TWINS.filter(([twin]) => outsideWindow(empty, twin).length).map(([, l]) => l);
  assert.deepEqual(caught, ["paints-the-terminator"], "the empty arm's discrimination changed");
  console.log(`  EMPTY/TEETH: catches ${caught.join(", ")} and is blind to the rest, correctly`);
});
