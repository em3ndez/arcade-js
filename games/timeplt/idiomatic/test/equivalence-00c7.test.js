// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampGridBox — memory-equivalent to the frozen oracle at ROM 0x00C7.
 *
 * GATE: unit-capture at a real dispatch with a two-byte scratch exclusion, a two-tape corpus that
 *   replays EVERY dispatch, and a crafted sweep of cursors the real data never presents. The
 *   routine calls nothing, so nothing here is dissolved.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM identical outside the scratch window, and the address
 *      pair the routine leaves behind identical too.
 *   2. THE DEAD STACK SCRATCH IS THE ONE EXCLUSION, pinned to [SP-2, SP): the oracle brackets its
 *      work with a push and a matching pop of the cursor, and the rewrite models no stack. Every
 *      arm walks the whole dump and asserts nothing escapes the window.
 *   3. RICH CORPUS, AND IT REALLY IS RICH FOR ONCE — 224 dispatches per tape at 224 DISTINCT
 *      cursors covering a contiguous sweep of the character plane. Counts and the distinct-cursor
 *      count are measured and asserted.
 *   4. CRAFTED — seven cursors the corpus does not present, each asserted absent from it: the
 *      start of the colour plane, cursors straddling the colour/character boundary, cursors
 *      straddling the character plane into work RAM, and one straddling work RAM into the sprite
 *      band.
 *   5. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY. At the real dispatch the moved set is exactly
 *      {sp} — the flag byte there ALREADY holds what the address addition leaves, which is a
 *      coincidence and is asserted as one — and a forced flag prior pins it at {f, sp}. The
 *      address pair holding the step is NOT excluded: the rewrite is held to it.
 *   6. TEETH — eight twins, each asserted caught on an exact count of the corpus and on every
 *      crafted cursor.
 *
 * HOLE: WHETHER ANY CALLER CONSUMES THE STEP left in the address pair is not established. The
 * rewrite writes it because the oracle leaves it written; nothing here watches a caller read it.
 *
 * HOLE: what the four codes DRAW is not decidable from memory equivalence. They are character
 * codes because of where they are written, and this gate fixes the four values and their four
 * offsets and claims nothing about the picture.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-00c7.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stampGridBox } from "../stampGridBox.js";
import { loc_00c7 as oracle } from "../../translated/loc_00c7.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x00c7;
const NEXT_CELL = 32;
const SCRATCH_BYTES = 2;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

/** What the two tapes present. Measured; a move here is a finding. */
const DISPATCHES = 224;
const FIRST_CURSOR = 0xa440;
const LAST_CURSOR = 0xa79e;

/** Cursors the corpus never presents. Each straddles a boundary the contiguous sweep stays inside. */
const CRAFTED_CURSORS = [0xa000, 0xa3e0, 0xa3ff, 0xa7de, 0xa7ff, 0xafdf, 0xaffe];

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

/** Masked state dump plus the address pair the routine leaves behind. */
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
  return null;
}

let entry = null;

/** Replay a whole session, comparing at every dispatch and recording what it presented. */
function replaySession(opts, candidate) {
  const base = buildRoutines();
  const original = base.get(TARGET);
  let dispatches = 0;
  let caught = 0;
  const cursors = new Set();
  const overrides = new Map([[TARGET, (mm) => {
    dispatches++;
    cursors.add(mm.regs.hl);
    if (entry === null) entry = mm.clone();
    if (unitDiff(candidate, mm)) caught++;
    return original(mm);
  }]]);
  const m = makeMachine(overrides, opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "session ran short");
  return { dispatches, caught, cursors };
}

let cache = null;
function sessions() {
  if (!cache) cache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, stampGridBox) }));
  return cache;
}

function entryState() {
  if (entry === null) sessions();
  return entry;
}

/** How many of the corpus dispatches, over both tapes, a candidate gets wrong. */
function corpusCaught(candidate) {
  let caught = 0;
  for (const [, opts] of TAPES) caught += replaySession(opts, candidate).caught;
  return caught;
}

function craft(cursor) {
  const m = entryState().clone();
  m.regs.hl = cursor;
  return m;
}

function craftedCaught(candidate) {
  return CRAFTED_CURSORS.filter((c) => unitDiff(candidate, craft(c))).length;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: stampGridBox == oracle outside the scratch window", { skip: SKIP }, () => {
  const e = entryState();
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");

  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  stampGridBox(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.de, b.regs.de, "the step left in the address pair diverged");
  assert.equal(a.regs.hl, b.regs.hl, "the cursor must come back where it went in");
  console.log(
    `  EQUAL: entry cursor=${hex4(e.regs.hl)} sp=${hex4(sp)}; identical outside ` +
      `[SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("CORPUS: 224 dispatches per tape at 224 distinct cursors, all identical", { skip: SKIP }, () => {
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES, `the ${s.label} dispatch count moved`);
    assert.equal(s.cursors.size, DISPATCHES, `the ${s.label} tape repeated a cursor`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    const sorted = [...s.cursors].sort((x, y) => x - y);
    assert.equal(sorted[0], FIRST_CURSOR, `the ${s.label} tape's first cursor moved`);
    assert.equal(sorted[sorted.length - 1], LAST_CURSOR, `the ${s.label} tape's last cursor moved`);
  }
  console.log(
    `  CORPUS: ${sessions().length} tapes x ${DISPATCHES} dispatches, cursors ` +
      `${hex4(FIRST_CURSOR)}..${hex4(LAST_CURSOR)}, identical on every one`,
  );
});

test("CRAFTED: cursors the corpus never presents, each straddling a boundary", { skip: SKIP }, () => {
  for (const cursor of CRAFTED_CURSORS) {
    assert.ok(
      ![...sessions()[0].cursors].includes(cursor),
      `${hex4(cursor)} is in the real corpus, so it is not covering a hole`,
    );
    const d = unitDiff(stampGridBox, craft(cursor));
    assert.equal(d, null, `cursor ${hex4(cursor)}: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${CRAFTED_CURSORS.length} boundary-straddling cursors identical`);
});

test("EXCLUDED, deliberately: the flag byte, the stack pointer and pc", { skip: SKIP }, () => {
  const e = entryState();
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  stampGridBox(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    ["sp"],
    "the excluded set changed shape at the real dispatch: only the stack pointer may differ, " +
      "because the flag byte there already holds what the address addition would leave",
  );
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.de, NEXT_CELL - 1, "the oracle leaves the second-to-third step behind");

  // THE FLAG COINCIDENCE ABOVE IS NOT THE GENERAL CASE, so force a prior where it cannot hold.
  const c = e.clone();
  const d = e.clone();
  c.regs.f = 0xff;
  d.regs.f = 0xff;
  oracle(c);
  stampGridBox(d);
  assert.deepEqual(
    REG_FIELDS.filter((k) => c.regs[k] !== d.regs[k]),
    ["f", "sp"],
    "with a flag prior the oracle must change, the excluded set is the flag byte and the stack " +
      "pointer and nothing more",
  );
  console.log(
    "  EXCLUDED: sp and pc at the real entry (its flag byte already matches); f as well once a " +
      "differing flag prior is forced — RAM, the cursor and the step are held",
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

const CODES = [86, 131, 199, 239];
const OFFSETS = [0, 1, NEXT_CELL, NEXT_CELL + 1];

function stamp(m, codes, offsets) {
  const cursor = m.regs.hl;
  for (let i = 0; i < codes.length; i++) m.mem8[cursor + offsets[i]] = codes[i];
  m.regs.de = NEXT_CELL - 1;
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: lays the block down one place along the line, so the whole fill is shifted. */
function brokenShiftedBlock(m) {
  stamp(m, CODES, OFFSETS.map((o) => o + NEXT_CELL));
}

/** BUG: the second pair goes one cell too far, so a gap opens between the halves. */
function brokenWideBlock(m) {
  stamp(m, CODES, [0, 1, NEXT_CELL * 2, NEXT_CELL * 2 + 1]);
}

/** BUG: the two halves of the block are the other way round. */
function brokenSwapsHalves(m) {
  stamp(m, [CODES[2], CODES[3], CODES[0], CODES[1]], OFFSETS);
}

/** BUG: one code is one out, which is the smallest wrong block there is. */
function brokenCodeOffByOne(m) {
  stamp(m, [CODES[0], CODES[1], CODES[2], CODES[3] + 1], OFFSETS);
}

/** BUG: lays down only the first half, so the second pair of cells keeps whatever was there. */
function brokenHalfBlock(m) {
  stamp(m, CODES.slice(0, 2), OFFSETS.slice(0, 2));
}

/** BUG: the right block, and the step is not left behind. */
function brokenDropsStep(m) {
  const cursor = m.regs.hl;
  for (let i = 0; i < CODES.length; i++) m.mem8[cursor + OFFSETS[i]] = CODES[i];
}

/** BUG: leaves the cursor where its own walk ended instead of putting it back. */
function brokenMovesCursor(m) {
  stamp(m, CODES, OFFSETS);
  m.regs.hl = m.regs.hl + NEXT_CELL + 1;
}

/**
 * Per twin: how many of the 448 corpus dispatches catch it, and how many of the crafted cursors.
 * `drops-step` falls far short of the whole corpus, and that is the useful number: the caller
 * re-loads the same step at the head of each of its fourteen passes, so only the first dispatch of
 * a pass has an address pair that differs, and after it the oracle's own leftover makes the twin
 * agree. 14 passes x 2 tapes = 28. Every count is measured and asserted as an equality, so a twin
 * caught on the WRONG set fails as loudly as one not caught at all.
 */
const CORPUS_SIZE = DISPATCHES * TAPES.length;

const TWINS = [
  ["no-op", brokenNoOp, CORPUS_SIZE],
  ["shifted-block", brokenShiftedBlock, CORPUS_SIZE],
  ["wide-block", brokenWideBlock, CORPUS_SIZE],
  ["swaps-halves", brokenSwapsHalves, CORPUS_SIZE],
  ["code-off-by-one", brokenCodeOffByOne, CORPUS_SIZE],
  ["half-block", brokenHalfBlock, CORPUS_SIZE],
  ["drops-step", brokenDropsStep, 28],
  ["moves-cursor", brokenMovesCursor, CORPUS_SIZE],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip: SKIP }, () => {
    const corpus = corpusCaught(twin);
    const crafted = craftedCaught(twin);
    assert.equal(corpus, expected, `the ${label} twin's corpus catch count moved`);
    assert.equal(
      crafted,
      CRAFTED_CURSORS.length,
      `the ${label} twin escaped a crafted cursor`,
    );
    console.log(
      `  TEETH/${label}: caught on ${corpus} of ${CORPUS_SIZE} corpus dispatches and ` +
        `${crafted} of ${CRAFTED_CURSORS.length} crafted cursors`,
    );
  });
}
