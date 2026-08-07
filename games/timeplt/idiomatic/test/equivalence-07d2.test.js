// SPDX-License-Identifier: GPL-3.0-only
/**
 * blankFourteenCharCells — memory-equivalent to the frozen oracle at ROM 0x07D2.
 *
 * GATE: strict unit-capture with NO exclusion — not even a stack window, because the frozen
 *   routine pushes nothing — plus a crafted sweep of every prior the run can start from, and
 *   teeth.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — the whole state dump, stack included.
 *   2. STORES — the twenty-eight cells really do carry the two constants afterwards, from
 *      arbitrary priors, so the comparison is not agreeing on a no-change.
 *   3. CORPUS — every dispatch of a driven and an undriven session, counts asserted.
 *   4. EXCLUDED — the register divergence pinned to a measured set.
 *   5. EXHAUSTIVE — the routine reads NOTHING, so its whole input space is the prior content of
 *      the cells it writes and of their neighbours. Two families cover it: every one of 256
 *      priors filled uniformly across a band two cells wider than the run at each end, and the
 *      band already painted the way a correct run leaves it with ONE cell disturbed. The second
 *      family is what discriminates — a twin that gets only the far end of the run wrong agrees
 *      on every uniform prior, and a disturbance outside the run is caught by nothing.
 *   6. TEETH — five twins, each caught, on an exact count of crafted entries. Two of them, the
 *      no-op and the one-short, score BELOW the total, which is the arm reporting its own holes:
 *      the cells outside the run are where those twins are allowed to agree.
 *
 * HOLE: one captured backdrop. Only the two planes are varied; nothing else can matter, because
 * the routine reads no cell at all.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-07d2.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { blankFourteenCharCells } from "../blankFourteenCharCells.js";
import { loc_07d2 as oracle } from "../../translated/loc_07d2.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x07d2;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const FIRST_CELL = 0xa79f;
const CELLS = 14;
const ONE_ROW_BACK = -32;
const BLANK = 0xf1;
const COLOUR = 0x16;
const COLOUR_PLANE_BIT = 0x0400;

/** The band the sweep repaints: two cells beyond the run at each end, on both planes. */
const BAND_FIRST = u16(FIRST_CELL + 2 * 32);
const BAND_CELLS = CELLS + 4;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 109, attract: 107 };

const EXCLUDED = ["f", "b", "d", "e", "h", "l", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

const runCells = () =>
  Array.from({ length: CELLS }, (_unused, i) => u16(FIRST_CELL + i * ONE_ROW_BACK));

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
  if (entry === null) gate(blankFourteenCharCells);
  return entry;
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

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b)[0] ?? null;
}

/** A real captured machine with the whole band, on both planes, set to one prior. */
function craft(prior) {
  const m = entryState().clone();
  for (let i = 0; i < BAND_CELLS; i++) {
    const cell = u16(BAND_FIRST + i * ONE_ROW_BACK);
    m.mem8[cell] = prior;
    m.mem8[cell & ~COLOUR_PLANE_BIT] = prior;
  }
  return m;
}

/**
 * The band already painted the way a correct run leaves it, with ONE cell disturbed. This is the
 * discriminating family: a twin that gets only the far end of the run wrong is invisible on a
 * uniform prior and caught here, and a disturbed cell OUTSIDE the run catches nothing at all.
 */
function craftDisturbed(index, value) {
  const m = entryState().clone();
  for (let i = 0; i < BAND_CELLS; i++) {
    const cell = u16(BAND_FIRST + i * ONE_ROW_BACK);
    m.mem8[cell] = BLANK;
    m.mem8[cell & ~COLOUR_PLANE_BIT] = COLOUR;
  }
  const odd = u16(BAND_FIRST + index * ONE_ROW_BACK);
  m.mem8[odd] = value;
  m.mem8[odd & ~COLOUR_PLANE_BIT] = value;
  return m;
}

const DISTURBANCES = [0x00, 0x5a, 0xff];

let entryCache = null;
function craftedEntries() {
  if (entryCache) return entryCache;
  entryCache = [];
  for (let prior = 0; prior < 256; prior++) entryCache.push(craft(prior));
  for (let i = 0; i < BAND_CELLS; i++) {
    for (const value of DISTURBANCES) entryCache.push(craftDisturbed(i, value));
  }
  return entryCache;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const m of craftedEntries()) if (unitDiff(candidate, m)) caught++;
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, blankFourteenCharCells) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

function paint(m, cells, blank, colour) {
  for (const cell of cells) {
    m.mem8[cell] = blank;
    m.mem8[cell & ~COLOUR_PLANE_BIT] = colour;
  }
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: one cell short, so the far end of the column keeps whatever was there. */
function brokenOneShort(m) {
  paint(m, runCells().slice(0, CELLS - 1), BLANK, COLOUR);
}

/** BUG: walks the other way along the plane. */
function brokenWrongDirection(m) {
  paint(m, Array.from({ length: CELLS }, (_u, i) => u16(FIRST_CELL - i * ONE_ROW_BACK)), BLANK, COLOUR);
}

/** BUG: blanks with the neighbouring code. */
function brokenWrongBlank(m) {
  paint(m, runCells(), BLANK + 1, COLOUR);
}

/** BUG: paints the colour plane a shade out. */
function brokenWrongColour(m) {
  paint(m, runCells(), BLANK, COLOUR + 1);
}

const TWINS = [
  ["no-op", brokenNoOp, 298],
  ["one-short", brokenOneShort, 259],
  ["wrong-direction", brokenWrongDirection, 310],
  ["wrong-blank", brokenWrongBlank, 310],
  ["wrong-colour", brokenWrongColour, 310],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: the whole dump, stack included", { skip }, () => {
  const r = gate(blankFourteenCharCells);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `a byte diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry sp=${hex4(entryState().regs.sp)}; identical, stack included`);
});

test("STORES: every cell of the run carries its constant, from an arbitrary prior", { skip }, () => {
  const m = craft(0x5a);
  blankFourteenCharCells(m);
  for (const cell of runCells()) {
    assert.equal(m.mem8[cell], BLANK, `${hex4(cell)} was not blanked`);
    assert.equal(m.mem8[cell & ~COLOUR_PLANE_BIT], COLOUR, `${hex4(cell)} was not coloured`);
  }
  const beyond = u16(FIRST_CELL + CELLS * ONE_ROW_BACK);
  assert.equal(m.mem8[beyond], 0x5a, "the run ran on past its last cell");
  console.log(`  STORES: ${CELLS} cells on both planes, and ${hex4(beyond)} left alone`);
});

test("CORPUS: every dispatch of two whole sessions replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  console.log(`  CORPUS: ${total} dispatches over ${TAPES.length} sessions, identical on each`);
});

test("EXCLUDED, deliberately: registers and pc, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  blankFourteenCharCells(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("EXHAUSTIVE: every prior of the band lands the same way", { skip }, () => {
  assert.equal(sweepCaught(blankFourteenCharCells), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(
    `  EXHAUSTIVE: ${craftedEntries().length} crafted entries identical — 256 uniform band ` +
      `priors and ${BAND_CELLS * DISTURBANCES.length} single-cell disturbances`,
  );
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${craftedEntries().length} crafted entries`);
  });
}
