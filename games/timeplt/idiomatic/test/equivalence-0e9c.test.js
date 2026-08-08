// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintDoubleTile — memory-equivalent to the frozen oracle at ROM 0x0E9C.
 *
 * GATE: crafted-entry, where the craft is a NUDGE ON A REAL STATE and the DISPATCH IS NATURAL,
 *   plus crafted sweeps from the entry that nudge produces. The cursor step at ROM 0x0028 is
 *   already decompiled, so the transfer to it is dissolved into a direct call here.
 *
 * WHY A NUDGE. Neither shipped tape reaches this address at all — measured zero dispatches on
 *   both across 6000 frames. Its one caller decomposes a value into how many marks of each size a
 *   meter needs, and this arm draws one size; on every dispatch the tapes really produce, that
 *   size's count comes out zero. So the craft is one byte: force the value the caller decomposes,
 *   at the caller's own dispatch, and let the GAME reach this arm with the rest of the machine
 *   coherent. Both tapes then dispatch it.
 *
 * What it exercises, holes stated:
 *   1. NUDGED CORPUS — every dispatch of two sessions, oracle against rewrite on clones of the
 *      same live machine, whole state dump compared outside the scratch window. The counts are
 *      small and are asserted, so a thin corpus cannot read as a thick one.
 *   2. UNNUDGED, NEITHER TAPE REACHES IT — asserted, so the nudge is justified by a check.
 *   3. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION, BOUNDED by [SP-2, SP): the oracle pushes a
 *      return address for the cursor step and pops it again. Only one of the two bytes actually
 *      differs at this entry, and that is asserted as the coincidence it is rather than taken for
 *      a narrower window. Every arm walks the whole dump and asserts nothing escapes the bound.
 *   4. THE CODE SWEEP — all 256 values of the code the caller supplies, which is the only
 *      coverage of the eight-bit wrap that makes the upper of the pair roll to zero.
 *   5. THE CURSOR SWEEP — eight cursors, and this is the arm that matters. Seven are not in the
 *      real corpus, and three of those are placed so the borrow to the cell below carries the pair
 *      OUT of the character plane, which is where a rewrite treating the plane change as a fixed
 *      subtraction parts company with the oracle. The real dispatch does none of that, and the
 *      per-twin counts below record exactly which cursors see it.
 *   6. THE COLOUR SWEEP — four values, which is enough: the colour is copied, not computed.
 *   7. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and nothing outside {a, f, sp} may move. The
 *      accumulator is in that set because the oracle's cursor step leaves the stepped low byte in
 *      it and the already-decompiled step does not; nothing here watches a caller read it.
 *   8. TEETH — seven twins, each asserted caught on exact counts of all three sweeps.
 *
 * HOLE: WHAT THE MARK MEANS is not decidable here. This gate fixes which two cells take the pair,
 * which two take the colour, and where the cursor lands; it says nothing about the picture.
 *
 * HOLE: one cursor, one code and one colour on real data, all three from a state that only exists
 * because of the nudge. Everything else here is crafted, and the counts say which is which.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0e9c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { paintDoubleTile } from "../paintDoubleTile.js";
import { loc_0e9c as oracle } from "../../translated/loc_0e9c.js";
import { retreatCharCursor } from "../retreatCharCursor.js";
import { u16, u8 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x0e9c;
const METER = 0x0dd7;
const CHARACTER_PLANE_BIT = 0x0400;
const SCRATCH_BYTES = 2;

/** The meter value the nudge forces. Its decomposition leaves exactly one mark of this size. */
const NUDGED_VALUE = 99;

/** Registers the rewrite may leave diverged. Dead for this routine, so it need not move them. */
const EXCLUDED = ["a", "f", "sp"];

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

/** Nudged dispatches each session produces. Measured; a move here is a finding. */
const NUDGED = { attract: 1, "coin-start": 3 };
const REAL_CURSOR = 0xa4e3;
const REAL_CODE = 50;
const REAL_COLOUR = 17;

function inScratch(addr, sp) {
  return addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;
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

/** Masked state dump plus the stepped cursor and the untouched address pair. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.de !== b.regs.de) return { addr: null, a: a.regs.de, b: b.regs.de };
  if (a.regs.hl !== b.regs.hl) return { addr: null, a: a.regs.hl, b: b.regs.hl };
  if (a.regs.b !== b.regs.b) return { addr: null, a: a.regs.b, b: b.regs.b };
  return null;
}

let entry = null;

function replaySession(opts, candidate, { nudge = true } = {}) {
  const base = buildRoutines();
  const meter = base.get(METER);
  const original = base.get(TARGET);
  const overrides = new Map();
  if (nudge) overrides.set(METER, (mm) => { mm.regs.a = NUDGED_VALUE; return meter(mm); });
  let dispatches = 0;
  let caught = 0;
  overrides.set(TARGET, (mm) => {
    dispatches++;
    if (entry === null && nudge) entry = mm.clone();
    if (unitDiff(candidate, mm)) caught++;
    return original(mm);
  });
  const m = makeMachine(overrides, opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "session ran short");
  return { dispatches, caught };
}

let cache = null;
function sessions() {
  if (!cache) cache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, paintDoubleTile) }));
  return cache;
}

function entryState() {
  if (entry === null) sessions();
  assert.notEqual(entry, null, "vacuous: the nudged sessions never reached the routine");
  return entry;
}

/** A real captured machine with the cursor, the code and the colour forced. */
function craft(cursor, code, colour) {
  const m = entryState().clone();
  m.regs.de = cursor;
  m.regs.b = code;
  m.regs.c = colour;
  return m;
}

/**
 * Eight cursors. The first is the one the nudged dispatch presents; the rest are placed so the
 * borrow to the cell below, or the carry out of the colour cell, crosses a plane boundary.
 */
const CURSORS = [REAL_CURSOR, 0xa400, 0xa401, 0xa41f, 0xa5ff, 0xa7ff, 0xa000, 0xa020];
const CODES = Array.from({ length: 256 }, (_unused, i) => i);
const COLOURS = [0, 1, REAL_COLOUR, 255];

const sweep = (candidate, entries) => entries.filter((e) => unitDiff(candidate, craft(...e))).length;

const CURSOR_ENTRIES = CURSORS.map((c) => [c, REAL_CODE, REAL_COLOUR]);
const CODE_ENTRIES = CODES.map((code) => [REAL_CURSOR, code, REAL_COLOUR]);
const COLOUR_ENTRIES = COLOURS.map((colour) => [REAL_CURSOR, REAL_CODE, colour]);

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("NUDGED CORPUS: every dispatch of two sessions replays identically", { skip: SKIP }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} session never reached the routine`);
    assert.equal(s.dispatches, NUDGED[s.label], `the ${s.label} nudged dispatch count moved`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  const e = entryState();
  assert.equal(e.regs.de, REAL_CURSOR, "the cursor the nudged dispatch presents moved");
  assert.equal(e.regs.b, REAL_CODE, "the code the nudged dispatch presents moved");
  assert.equal(e.regs.c, REAL_COLOUR, "the colour the nudged dispatch presents moved");
  console.log(
    `  NUDGED CORPUS: ${total} dispatches over two sessions at cursor ${hex4(REAL_CURSOR)}, ` +
      `code ${REAL_CODE}, colour ${REAL_COLOUR}; identical on each`,
  );
});

test("UNNUDGED, NEITHER TAPE REACHES IT: the nudge is what buys the entry", { skip: SKIP }, () => {
  for (const [label, opts] of TAPES) {
    const r = replaySession(opts, paintDoubleTile, { nudge: false });
    assert.equal(r.dispatches, 0, `the ${label} tape now reaches this arm on its own`);
  }
  console.log("  UNNUDGED: both shipped tapes dispatch it 0 times in the entry budget");
});

test("THE SCRATCH WINDOW is bounded by the two bytes below the entry stack pointer", { skip: SKIP }, () => {
  const e = entryState();
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  paintDoubleTile(b);
  const dirty = allDiffs(a, b).map((d) => d.addr);
  assert.ok(dirty.length > 0, "no divergence at all — the oracle's scratch push vanished");
  assert.ok(
    dirty.every((addr) => addr >= sp - SCRATCH_BYTES && addr < sp),
    `a divergence escaped the window: ${dirty.map(hex4).join(" ")}`,
  );
  // ONE OF THE TWO BYTES IS CLEAN HERE, and it is a coincidence rather than a narrower window:
  // the high half of the address the oracle pushes equals what was already sitting there. The
  // window is an upper bound, which is why this arm bounds it rather than asserting both bytes.
  assert.deepEqual(dirty, [sp - 2], "the second scratch byte now differs too; the bound still holds");
  console.log(`  SCRATCH: sp=${hex4(sp)}, only ${dirty.map(hex4).join(" ")} differs of two bounded`);
});

test("THE CODE SWEEP: all 256 codes, where the pair's upper byte wraps", { skip: SKIP }, () => {
  assert.equal(sweep(paintDoubleTile, CODE_ENTRIES), 0, "the rewrite diverged somewhere in the code sweep");
  const wrapping = craft(REAL_CURSOR, 255, REAL_COLOUR);
  paintDoubleTile(wrapping);
  assert.equal(wrapping.mem8[REAL_CURSOR], 0, "code 255 must put 0 in the upper cell, not 256");
  assert.equal(wrapping.mem8[REAL_CURSOR - 1], 255, "the lower cell keeps the code itself");
  console.log("  CODE SWEEP: 256 codes identical, the 255 -> 0 wrap of the upper cell included");
});

test("THE CURSOR SWEEP: eight cursors, six of them straddling a plane", { skip: SKIP }, () => {
  for (const cursor of CURSORS) {
    const d = unitDiff(paintDoubleTile, craft(cursor, REAL_CODE, REAL_COLOUR));
    assert.equal(d, null, `cursor ${hex4(cursor)}: ${show(d)}`);
  }

  // THE STRADDLE IS REAL AND NOT A STORY. At this cursor the borrow takes the lower cell out of
  // the character plane, so clearing the plane bit leaves it where it already is and the colour
  // pair lands one cell inside the character plane rather than beside the mark.
  const straddle = craft(0xa400, REAL_CODE, REAL_COLOUR);
  oracle(straddle);
  assert.equal(straddle.mem8[0xa3ff], REAL_COLOUR, "the colour no longer lands below the boundary");
  assert.equal(straddle.mem8[0xa400], REAL_COLOUR, "the colour no longer overwrites the mark here");
  console.log(`  CURSOR SWEEP: ${CURSORS.length} cursors identical, the plane straddles included`);
});

test("THE COLOUR SWEEP: the colour is copied, not computed", { skip: SKIP }, () => {
  assert.equal(sweep(paintDoubleTile, COLOUR_ENTRIES), 0, "the rewrite diverged somewhere in the colour sweep");
  console.log(`  COLOUR SWEEP: ${COLOURS.length} colours identical`);
});

test("EXCLUDED, deliberately: the accumulator, the flag byte, the stack pointer and pc", { skip: SKIP }, () => {
  const e = entryState();
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  paintDoubleTile(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register outside the excluded set diverged: only the accumulator, the flag byte and the " +
      "stack pointer may differ",
  );
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.b, b.regs.b, "the code must come back out unchanged");
  assert.equal(a.regs.hl, b.regs.hl, "the other address pair must come back where it went in");
  console.log(`  EXCLUDED: a, f, sp and pc — RAM, the cursor, the code and the spare pair are held`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

/** The rewrite's own shape, parameterised so a twin can change exactly one decision. */
function stamp(m, { upperFirst = true, plane = CHARACTER_PLANE_BIT, colourCells = 2,
  step = true, sameCode = false } = {}) {
  const { regs, mem8 } = m;
  const cursor = regs.de;
  const below = u16(cursor - 1);
  const upper = sameCode ? regs.b : u8(regs.b + 1);
  mem8[upperFirst ? cursor : below] = upper;
  mem8[upperFirst ? below : cursor] = regs.b;
  const colour = below & ~plane;
  mem8[colour] = regs.c;
  if (colourCells > 1) mem8[u16(colour + 1)] = regs.c;
  regs.de = u16(colour + 1) | CHARACTER_PLANE_BIT;
  if (step) retreatCharCursor(m);
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: the two codes of the pair go into the other order. */
function brokenSwapsPair(m) {
  stamp(m, { upperFirst: false });
}

/** BUG: both cells get the same code, so the mark is one shape repeated. */
function brokenSameCode(m) {
  stamp(m, { sameCode: true });
}

/** BUG: the colour is written in the plane the mark is in rather than beside it. */
function brokenColourInPlace(m) {
  stamp(m, { plane: 0 });
}

/** BUG: only one of the two cells gets a colour. */
function brokenHalfColour(m) {
  stamp(m, { colourCells: 1 });
}

/** BUG: the cursor is not stepped, so the next mark lands on this one. */
function brokenNoStep(m) {
  stamp(m, { step: false });
}

/** BUG: the plane bit is cleared with a subtraction instead, which is the same thing until it isn't. */
function brokenSubtractsPlane(m) {
  const { regs, mem8 } = m;
  const cursor = regs.de;
  const below = u16(cursor - 1);
  mem8[cursor] = u8(regs.b + 1);
  mem8[below] = regs.b;
  const colour = u16(below - CHARACTER_PLANE_BIT);
  mem8[colour] = regs.c;
  mem8[u16(colour + 1)] = regs.c;
  regs.de = u16(u16(colour + 1) + CHARACTER_PLANE_BIT);
  retreatCharCursor(m);
}

/**
 * Per twin: how many of the cursor, code and colour sweeps catch it. Every count is measured and
 * asserted as an equality, so a twin caught on the WRONG set fails as loudly as one not caught.
 *
 * `subtracts-plane` is the one to read: across the code and colour sweeps, which both sit at the
 * cursor real data presents, it is caught ZERO times — subtracting and clearing the bit agree
 * wherever the bit is set. Only three of the eight cursors see it. That is the whole reason the
 * cursor sweep exists, and the reason the rewrite spells the plane change out as a bit operation.
 *
 * Three twins fall two short across the cursors and one falls one short, for one reason worth
 * knowing: at two of the eight cursors the borrow already carries the pair OUT of the character
 * plane, so the colour lands on the very cells the mark went to and overwrites it — nothing about
 * the mark is observable there. `half-colour` instead misses the cursor whose colour writes both
 * fall in unmapped space, where writing one of them and writing two are the same thing.
 */
const TWINS = [
  ["no-op", brokenNoOp, 8, 256, 4],
  ["swaps-pair", brokenSwapsPair, 6, 256, 4],
  ["same-code", brokenSameCode, 6, 256, 4],
  ["colour-in-place", brokenColourInPlace, 6, 256, 4],
  ["half-colour", brokenHalfColour, 7, 256, 4],
  ["no-step", brokenNoStep, 8, 256, 4],
  ["subtracts-plane", brokenSubtractsPlane, 3, 0, 0],
];

for (const [label, twin, cursorsCaught, codesCaught, coloursCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exact counts of all three sweeps`, { skip: SKIP }, () => {
    assert.equal(sweep(twin, CURSOR_ENTRIES), cursorsCaught, `the ${label} cursor count moved`);
    assert.equal(sweep(twin, CODE_ENTRIES), codesCaught, `the ${label} code count moved`);
    assert.equal(sweep(twin, COLOUR_ENTRIES), coloursCaught, `the ${label} colour count moved`);
    console.log(
      `  TEETH/${label}: caught on ${cursorsCaught}/${CURSORS.length} cursors, ` +
        `${codesCaught}/${CODES.length} codes, ${coloursCaught}/${COLOURS.length} colours`,
    );
  });
}
