// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCaptionTenPastSharedColour — memory-equivalent to the frozen oracle at ROM 0x0C23.
 *
 * GATE: unit-capture at a real dispatch with a two-byte scratch exclusion, a two-tape corpus,
 *   and two crafted sweeps — the whole selector range and the whole colour cycle. Both routines
 *   it transfers to, the wide-table fetch at ROM 0x018C and the caption painter at ROM 0x0BFF,
 *   are already decompiled, so both transfers are dissolved into direct calls here.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM identical outside the scratch window, and the colour, the
 *      cursor and the run pointer the painting leaves behind identical too.
 *   2. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION, pinned to [SP-2, SP): the oracle pushes a
 *      return address for the fetch it calls and pops it again; the rewrite models no stack. The
 *      window is MEASURED dirty at the real dispatch, and every arm walks the whole dump and
 *      asserts nothing escapes it.
 *   3. THE CORPUS PRESENTS EXACTLY ONE SELECTOR PER TAPE and one colour-cycle value per tape.
 *      Measured and asserted, which is why the two sweeps below carry this gate rather than the
 *      real data.
 *   4. SELECTOR SWEEP — every entry of the record table, 0 through 32. The upper end is not a
 *      guess: selector 33 sends the painter at an address it cannot write, and the arm asserts
 *      that BOTH sides fail there, which is what fixes the table's extent.
 *   5. COLOUR SWEEP — all 256 values of the cell the colour follows, which is the only coverage
 *      of both the eight-bit wrap of the bias and the four-bit mask.
 *   6. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and bounded by {a, f, sp}: a register outside
 *      that set fails, and a rewrite that clobbers fewer of them stays green.
 *   7. TEETH — eight twins, each asserted caught on exact counts of both sweeps.
 *
 * HOLE: THE ACCUMULATOR IS EXCLUDED. The oracle leaves it holding the code that ends the glyph
 * run; the rewrite never assigns it. Nothing here watches a caller read it.
 *
 * HOLE: WHICH captions these are is not decidable from memory equivalence. This gate fixes which
 * table the selector indexes, where the destination and the glyphs sit inside a record, and how
 * the colour is derived — and claims nothing about the words.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0c23.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { drawCaptionTenPastSharedColour } from "../drawCaptionTenPastSharedColour.js";
import { loc_0c23 as oracle } from "../../translated/loc_0c23.js";
import { drawTextRun } from "../drawTextRun.js";
import { fetchWideTableWord } from "../fetchWideTableWord.js";
import { u8, u16 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x0c23;
const RECORD_TABLE = 0x0c50;
const GLYPHS_FROM = 3;
const COLOUR_CYCLE = 0xad0c;
const COLOUR_BIAS = 10;
const COLOUR_MASK = 0x0f;
const SCRATCH_BYTES = 2;

/** Registers the rewrite may leave diverged. Dead for this routine, so it need not move them. */
const EXCLUDED = ["a", "f", "sp"];

/** The last selector whose record the painter can follow without leaving writable memory. */
const LAST_SELECTOR = 32;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

/** What the two tapes present. Measured; a move here is a finding. */
const DISPATCHES = { attract: 11, "coin-start": 19 };
const REAL_SELECTORS = { attract: [27], "coin-start": [26] };
const REAL_CYCLES = { attract: [2], "coin-start": [1] };

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

/**
 * Masked state dump plus the three values the painting leaves behind. A candidate that THROWS is
 * a divergence, not a crash: a wrong record pointer sends the painter at unwritable memory, and
 * that is exactly the failure some twins here are built to cause.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.c !== b.regs.c) return { addr: null, a: a.regs.c, b: b.regs.c };
  if (a.regs.de !== b.regs.de) return { addr: null, a: a.regs.de, b: b.regs.de };
  if (a.regs.hl !== b.regs.hl) return { addr: null, a: a.regs.hl, b: b.regs.hl };
  return null;
}

let entry = null;

function replaySession(opts, candidate) {
  const base = buildRoutines();
  const original = base.get(TARGET);
  let dispatches = 0;
  let caught = 0;
  const selectors = new Set();
  const cycles = new Set();
  const overrides = new Map([[TARGET, (mm) => {
    dispatches++;
    selectors.add(mm.regs.a);
    cycles.add(mm.mem8[COLOUR_CYCLE]);
    if (entry === null) entry = mm.clone();
    if (unitDiff(candidate, mm)) caught++;
    return original(mm);
  }]]);
  const m = makeMachine(overrides, opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "session ran short");
  return { dispatches, caught, selectors, cycles };
}

let cache = null;
function sessions() {
  if (!cache) cache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, drawCaptionTenPastSharedColour) }));
  return cache;
}

function entryState() {
  if (entry === null) sessions();
  return entry;
}

/** A real captured machine with the selector and the colour-cycle cell forced. */
function craft(selector, cycle) {
  const m = entryState().clone();
  m.regs.a = selector;
  m.mem8[COLOUR_CYCLE] = cycle;
  return m;
}

const SELECTORS = Array.from({ length: LAST_SELECTOR + 1 }, (_unused, i) => i);
const CYCLES = Array.from({ length: 256 }, (_unused, i) => i);

function selectorSweepCaught(candidate) {
  return SELECTORS.filter((s) => unitDiff(candidate, craft(s, 2))).length;
}

function colourSweepCaught(candidate) {
  const real = REAL_SELECTORS.attract[0];
  return CYCLES.filter((c) => unitDiff(candidate, craft(real, c))).length;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: drawCaptionTenPastSharedColour == oracle outside the scratch window", { skip: SKIP }, () => {
  const e = entryState();
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");

  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  drawCaptionTenPastSharedColour(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.c, b.regs.c, "the colour diverged");
  assert.equal(a.regs.de, b.regs.de, "the cursor left behind diverged");
  assert.equal(a.regs.hl, b.regs.hl, "the run pointer left behind diverged");

  const dirty = allDiffs(a, b).map((d) => d.addr);
  assert.deepEqual(
    dirty,
    [sp - 2, sp - 1],
    "the scratch window is not both bytes here, so the exclusion is the wrong shape",
  );
  console.log(
    `  EQUAL: entry selector=${e.regs.a} cycle=${e.mem8[COLOUR_CYCLE]} sp=${hex4(sp)}; ` +
      `identical outside ${dirty.map(hex4).join(" ")}`,
  );
});

test("THE CORPUS PRESENTS ONE SELECTOR PER TAPE, which is why the sweeps carry it", { skip: SKIP }, () => {
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.deepEqual([...s.selectors], REAL_SELECTORS[s.label], `the ${s.label} selector set moved`);
    assert.deepEqual([...s.cycles], REAL_CYCLES[s.label], `the ${s.label} colour-cycle set moved`);
  }
  console.log(
    `  CORPUS: ${sessions().map((s) => `${s.label} ${s.dispatches} at selector ${[...s.selectors]}`).join(", ")}`,
  );
});

test("SELECTOR SWEEP: every entry of the record table, and where the table ends", { skip: SKIP }, () => {
  for (const selector of SELECTORS) {
    const d = unitDiff(drawCaptionTenPastSharedColour, craft(selector, 2));
    assert.equal(d, null, `selector ${selector}: ${show(d)}`);
  }

  // THE UPPER END IS MEASURED, NOT ASSUMED: one past it, both sides fail the same way.
  const past = craft(LAST_SELECTOR + 1, 2);
  const other = past.clone();
  assert.throws(() => oracle(past), "selector 33 no longer leaves writable memory for the oracle");
  assert.throws(() => drawCaptionTenPastSharedColour(other), "selector 33 no longer leaves writable memory for the rewrite");
  console.log(
    `  SELECTOR SWEEP: selectors 0..${LAST_SELECTOR} identical; ${LAST_SELECTOR + 1} throws on both sides`,
  );
});

test("COLOUR SWEEP: all 256 values of the cell the colour follows", { skip: SKIP }, () => {
  for (const cycle of CYCLES) {
    const d = unitDiff(drawCaptionTenPastSharedColour, craft(REAL_SELECTORS.attract[0], cycle));
    assert.equal(d, null, `cycle=${cycle}: ${show(d)}`);
  }

  // THE TWO ARITHMETIC EDGES, read back out of the colour the rewrite leaves.
  const wrapping = craft(REAL_SELECTORS.attract[0], 0xff);
  drawCaptionTenPastSharedColour(wrapping);
  assert.equal(wrapping.regs.c, u8(0xff + COLOUR_BIAS) & COLOUR_MASK, "the byte wrap of the bias moved");
  const masking = craft(REAL_SELECTORS.attract[0], 0x70);
  drawCaptionTenPastSharedColour(masking);
  assert.equal(masking.regs.c, (0x70 + COLOUR_BIAS) & COLOUR_MASK, "the four-bit mask moved");
  console.log(`  COLOUR SWEEP: 256 cycle values identical, the byte wrap and the mask included`);
});

test("EXCLUDED, deliberately: the accumulator, the flag byte, the stack pointer and pc", { skip: SKIP }, () => {
  const e = entryState();
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  drawCaptionTenPastSharedColour(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved.filter((k) => !EXCLUDED.includes(k)),
    [],
    "a register outside the declared excluded set diverged",
  );
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: a, f, sp and pc — RAM, the colour and both pointers are held`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

/** The rewrite's own shape, parameterised so a twin can change exactly one decision. */
function stamp(m, { table = RECORD_TABLE, glyphsFrom = GLYPHS_FROM, bias = COLOUR_BIAS,
  mask = COLOUR_MASK, cycleCell = COLOUR_CYCLE, swapDestination = false } = {}) {
  const { regs, mem8, mem16 } = m;
  regs.hl = table;
  fetchWideTableWord(m);
  const record = regs.de;
  const word = mem16[record];
  regs.de = swapDestination ? ((word << 8) | (word >> 8)) & 0xffff : word;
  regs.hl = u16(record + glyphsFrom);
  regs.c = u8(mem8[cycleCell] + bias) & mask;
  return drawTextRun(m);
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: indexes a table one entry along, so every selector picks the neighbouring caption. */
function brokenShiftedTable(m) {
  return stamp(m, { table: RECORD_TABLE + 2 });
}

/** BUG: starts the glyphs at the byte the record steps over, so that byte is painted first. */
function brokenGlyphsFromTwo(m) {
  return stamp(m, { glyphsFrom: 2 });
}

/** BUG: starts the glyphs one byte late, so the caption loses its first character. */
function brokenGlyphsFromFour(m) {
  return stamp(m, { glyphsFrom: 4 });
}

/** BUG: reads the destination the other way round, so the caption lands somewhere else. */
function brokenSwapsDestination(m) {
  return stamp(m, { swapDestination: true });
}

/** BUG: no bias, so the whole colour cycle is rotated. */
function brokenNoBias(m) {
  return stamp(m, { bias: 0 });
}

/** BUG: no mask, so a large cycle value puts a colour outside the sixteen. */
function brokenNoMask(m) {
  return stamp(m, { mask: 0xff });
}

/** BUG: the colour follows a neighbouring cell. */
function brokenWrongCycleCell(m) {
  return stamp(m, { cycleCell: COLOUR_CYCLE + 1 });
}

/**
 * Per twin: how many of the 33 selectors and how many of the 256 cycle values catch it. Every
 * number is measured and asserted as an equality, so a twin caught on the WRONG set fails as
 * loudly as one not caught at all. Two of them fall short, and both shortfalls are the point of
 * having two sweeps. `no-mask` is caught ZERO times across the selector sweep, because that sweep
 * fixes the cycle value at 2 and 2 plus the bias has no bits for a mask to remove — only the
 * colour sweep sees it, on the 240 values where the sum runs past four bits. `wrong-cycle-cell`
 * reads a neighbouring cell whose value the craft does not touch, so it agrees on the 16 cycle
 * values congruent to that one, and is caught on the other 240.
 */
const TWINS = [
  ["no-op", brokenNoOp, 33, 256],
  ["shifted-table", brokenShiftedTable, 33, 256],
  ["glyphs-from-two", brokenGlyphsFromTwo, 33, 256],
  ["glyphs-from-four", brokenGlyphsFromFour, 33, 256],
  ["swaps-destination", brokenSwapsDestination, 33, 256],
  ["no-bias", brokenNoBias, 33, 256],
  ["no-mask", brokenNoMask, 0, 240],
  ["wrong-cycle-cell", brokenWrongCycleCell, 33, 240],
];

for (const [label, twin, selectorsCaught, cyclesCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exact counts of both sweeps`, { skip: SKIP }, () => {
    assert.equal(selectorSweepCaught(twin), selectorsCaught, `the ${label} selector count moved`);
    assert.equal(colourSweepCaught(twin), cyclesCaught, `the ${label} cycle count moved`);
    console.log(
      `  TEETH/${label}: caught on ${selectorsCaught} of ${SELECTORS.length} selectors and ` +
        `${cyclesCaught} of ${CYCLES.length} cycle values`,
    );
  });
}
