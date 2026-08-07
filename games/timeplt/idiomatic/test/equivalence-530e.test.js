// SPDX-License-Identifier: GPL-3.0-only
/**
 * blankCellsPaintedLastPass — memory-equivalent to the frozen oracle at ROM 0x530E.
 *
 * GATE: strict unit-capture replayed over every dispatch of the shared coin -> start tape, plus an
 *   exhaustive crafted sweep over the list's write cursor, plus teeth.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at every real dispatch — the whole state dump is identical, the stack included: the
 *      exclusion window is measured at ZERO bytes and asserted so.
 *   2. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   3. EXCLUDED, deliberately — the register set that may differ is pinned by measurement.
 *   4. CORPUS — every dispatch of the session replayed on a clone, more than a thousand of them.
 *   5. EXHAUSTIVE — all 256 cursor values against a fully seeded page. This is the arm that
 *      reaches the empty list, the masked cursor, the count that wraps the loop counter round,
 *      and a read cursor that walks off the end of the entries.
 *   6. THE MASK IS ALMOST DEAD, and the gate says so with a number. Dropping the top bit changes
 *      the entry COUNT not at all — the bit's weight falls outside the five bits the count keeps —
 *      so it can only matter where one reading makes the list empty and the other does not. The
 *      twin that drops the mask is caught on exactly ONE cursor of 256, which the count asserts;
 *      a separate arm shows three cursors behaving identically with and without the bit.
 *   7. THE COUNT THAT WRAPS — a cursor three past the header leaves a loop counter of ZERO, which
 *      the hardware's loop treats as 256 passes and not none. The arm asserts the wrap happens.
 *   8. THE ERASURES LAND — the blank shape is read back out of the character plane for each
 *      entry, the colour plane is checked to be untouched, and the entry already above the
 *      sprites is checked to be passed over.
 *   9. TEETH — seven twins with exact catch counts over the crafted sweep.
 *
 * HOLE: the seeded list points its entries at colour-plane cells chosen here. Nothing says which
 * cells the game really queues, only that whatever address an entry carries is the one blanked.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-530e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { blankCellsPaintedLastPass } from "../blankCellsPaintedLastPass.js";
import { loc_530e as oracle } from "../../translated/loc_530e.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { DEFERRED_BLANK_CURSOR } from "../names.js";

const TARGET = 0x530e;
const FRAMES = 1500;
const DISPATCHES = 1265;

const FIRST_ENTRY = 0xae84;
const ENTRY_BYTES = 4;
const CURSOR_BITS = 0x7f;
const TO_CHARACTER_PLANE = 0x0400;
const ABOVE_SPRITES = 0x10;
const BLANK = 32;

/** The whole page is seeded, for the same reason the sibling list's gate seeds it: see 5 above. */
const PAGE_BASE = 0xae00;
const PAGE_SLOTS = 64;
const SEEDED_PLANE = 0xa180;
const SEEDED_HIGH = SEEDED_PLANE >> 8;
const SEEDED_SHAPE = 0x41;
const SEEDED_TINT = 0x03;
const FIRST_SLOT = (FIRST_ENTRY - PAGE_BASE) / ENTRY_BYTES;
const LIST_ENTRIES = 4;
const LIST_CURSOR = 4 + LIST_ENTRIES * ENTRY_BYTES;
const PRIORITY_SLOT = FIRST_SLOT + LIST_ENTRIES - 1;
const cellOfSlot = (slot) => SEEDED_PLANE + slot;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["f", "h", "l", "sp"];

const CURSORS = Array.from({ length: 256 }, (_unused, i) => i);
const SWEEP_SIZE = CURSORS.length;

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

/** A candidate that walks out of the page throws on the write; that IS a divergence, so it counts. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch {
    return { addr: null, a: "ran", b: "threw" };
  }
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

let entry = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const cursors = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    cursors.add(mm.mem16[DEFERRED_BLANK_CURSOR] & 0xff);
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
  return { dispatches, caught, cursors };
}

function entryState() {
  if (entry === null) replay(blankCellsPaintedLastPass);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

function craft(cursor) {
  const m = entryState().clone();
  for (let slot = 0; slot < PAGE_SLOTS; slot++) {
    const at = PAGE_BASE + slot * ENTRY_BYTES;
    const cell = cellOfSlot(slot);
    m.mem8[at] = cell & 0xff;
    m.mem8[at + 1] = SEEDED_HIGH;
    m.mem8[at + 2] = (SEEDED_SHAPE + slot) & 0xff;
    m.mem8[at + 3] = (SEEDED_TINT + slot) & 0xff;
    m.mem8[cell] = slot === PRIORITY_SLOT ? ABOVE_SPRITES : SEEDED_TINT;
    m.mem8[cell | TO_CHARACTER_PLANE] = SEEDED_SHAPE;
  }
  m.mem8[DEFERRED_BLANK_CURSOR] = cursor; // only the low half is read; the high half stays a seeded entry byte
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const cursor of CURSORS) if (unitDiff(candidate, craft(cursor))) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

const nextByte = (cursor) => (cursor & 0xff00) | ((cursor + 1) & 0xff);

function blankList(m, o) {
  const opt = {
    mask: CURSOR_BITS, honourPriority: true, header: 4, forLoop: false, page: true,
    blank: BLANK, alsoColour: false, ...o,
  };
  const { mem8, mem16 } = m;
  const filled = (((mem16[DEFERRED_BLANK_CURSOR] & 0xff) & opt.mask) - opt.header) & 0xff;
  if (filled === 0) return;
  let left = (filled >> 2) & 0x1f;
  if (opt.forLoop && left === 0) return;
  let cursor = FIRST_ENTRY;
  const step = opt.page ? nextByte : (c) => (c + 1) & 0xffff;
  do {
    const low = mem8[cursor];
    cursor = step(cursor);
    const cell = low | (mem8[cursor] << 8);
    cursor = step(step(step(cursor)));
    if (!opt.honourPriority || (mem8[cell] & ABOVE_SPRITES) === 0) {
      mem8[cell | TO_CHARACTER_PLANE] = opt.blank;
      if (opt.alsoColour) mem8[cell] = opt.blank;
    }
    left = (left - 1) & 0xff;
  } while (left !== 0);
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: reads the whole cursor byte instead of masking its top bit away. */
function brokenNoMask(m) {
  blankList(m, { mask: 0xff });
}

/** BUG: blanks entries that are already above the sprites. */
function brokenIgnoresPriority(m) {
  blankList(m, { honourPriority: false });
}

/** BUG: blanks the colour plane as well, which this entry leaves alone. */
function brokenAlsoColour(m) {
  blankList(m, { alsoColour: true });
}

/** BUG: the blank shape is one out. */
function brokenBlankCode(m) {
  blankList(m, { blank: BLANK + 1 });
}

/** BUG: a plain counted loop, so a count of zero blanks nothing where the original blanks 256. */
function brokenForLoop(m) {
  blankList(m, { forLoop: true });
}

/** BUG: the read cursor carries out of its page instead of wrapping inside it. */
function brokenLeavesPage(m) {
  blankList(m, { page: false });
}

/** Each twin's exact catch count over the 256 crafted cursors. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 254],
  ["no-mask", brokenNoMask, 1],
  ["ignores-priority", brokenIgnoresPriority, 230],
  ["blanks-the-colour-plane", brokenAlsoColour, 254],
  ["blank-code-off-by-one", brokenBlankCode, 254],
  ["for-loop", brokenForLoop, 6],
  ["cursor-leaves-page", brokenLeavesPage, 6],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: blankCellsPaintedLastPass == oracle over the whole dump", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  blankCellsPaintedLastPass(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: sp=${hex4(entryState().regs.sp)}, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(LIST_CURSOR));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  blankCellsPaintedLastPass(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real session replays identically", { skip }, () => {
  const r = replay(blankCellsPaintedLastPass);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  console.log(`  CORPUS: ${r.dispatches} dispatches, cursors ${[...r.cursors].sort((x, y) => x - y)}`);
});

test("EXHAUSTIVE: all 256 crafted cursors behave as the oracle", { skip }, () => {
  assert.equal(sweepCaught(blankCellsPaintedLastPass), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} cursors identical`);
});

test("THE MASK IS ALMOST DEAD: the top bit changes nothing at these cursors", { skip }, () => {
  // Only cursors whose entry run stops short of the slot the cursor byte itself sits in: once the
  // loop wraps that far the cursor IS entry data, and its top bit is then legitimately visible.
  for (const cursor of [LIST_CURSOR, 0x04, 0x44]) {
    const plain = craft(cursor);
    const flagged = craft(cursor | 0x80);
    blankCellsPaintedLastPass(plain);
    blankCellsPaintedLastPass(flagged);
    // The cursor cell itself necessarily differs — it is what was set — so it is excluded here
    // and nowhere else; every other byte of the two dumps must agree.
    const strays = allDiffs(plain, flagged).filter((d) => d.addr !== DEFERRED_BLANK_CURSOR);
    assert.deepEqual(strays, [], `cursor ${cursor}: setting the top bit changed the result`);
  }
  console.log("  MASK: three cursors, identical with and without the top bit");
});

test("THE COUNT THAT WRAPS: a cursor three past the header runs the loop round", { skip }, () => {
  const watched = cellOfSlot(FIRST_SLOT) | TO_CHARACTER_PLANE;
  const empty = craft(0x04);
  blankCellsPaintedLastPass(empty);
  assert.equal(empty.mem8[watched], SEEDED_SHAPE, "a bare header blanks nothing");

  const wraps = craft(0x07);
  blankCellsPaintedLastPass(wraps);
  assert.equal(wraps.mem8[watched], BLANK, "a cursor of seven must run the loop round, not skip it");
  console.log("  WRAPS: cursor 4 blanks nothing; cursor 7 wraps the counter and blanks");
});

test("THE ERASURES LAND: the character plane is blanked, the colour plane is not", { skip }, () => {
  const m = craft(LIST_CURSOR);
  blankCellsPaintedLastPass(m);
  for (let slot = FIRST_SLOT; slot < PRIORITY_SLOT; slot++) {
    const cell = cellOfSlot(slot);
    assert.equal(m.mem8[cell | TO_CHARACTER_PLANE], BLANK, `slot ${slot} shape`);
    assert.equal(m.mem8[cell], SEEDED_TINT, `slot ${slot} colour must be untouched`);
  }
  const skipped = cellOfSlot(PRIORITY_SLOT);
  assert.equal(m.mem8[skipped | TO_CHARACTER_PLANE], SEEDED_SHAPE, "the priority entry is untouched");
  const past = cellOfSlot(PRIORITY_SLOT + 1);
  assert.equal(m.mem8[past | TO_CHARACTER_PLANE], SEEDED_SHAPE, "the entry past the list is untouched");
  assert.notEqual(SEEDED_SHAPE, BLANK, "vacuous: the seeded shape already is the blank one");
  console.log(`  LANDS: ${LIST_ENTRIES - 1} cells blanked, 1 skipped for priority`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of cursors`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} cursors`);
  });
}
