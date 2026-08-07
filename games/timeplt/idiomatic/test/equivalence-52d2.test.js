// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintDeferredCells — memory-equivalent to the frozen oracle at ROM 0x52D2.
 *
 * GATE: strict unit-capture replayed over every dispatch of the shared coin -> start tape, plus an
 *   exhaustive crafted sweep over the list's write cursor and its tint bias, plus teeth.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at every real dispatch — the whole state dump is identical, the stack included: the
 *      exclusion window is measured at ZERO bytes and asserted so.
 *   2. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   3. EXCLUDED, deliberately — the register set that may differ is pinned by measurement.
 *   4. CORPUS — every dispatch of the session replayed on a clone, more than a thousand of them,
 *      with the set of cursor positions the session presents reported.
 *   5. EXHAUSTIVE — all 256 cursor values against a seeded list, crossed with three tint biases.
 *      This is the arm that reaches the empty list, the count that wraps the loop counter round,
 *      and a read cursor that walks off the end of the entries.
 *   6. THE COUNT THAT WRAPS — a cursor three past the header leaves a loop counter of ZERO, which
 *      the hardware's loop treats as 256 passes and not none. The arm asserts the wrap happens, so
 *      the "for-loop" twin below cannot be dismissed as unreachable.
 *   7. THE EDITS LAND — with a list seeded by hand, the shape and the biased tint are read back
 *      out of both planes for every entry, so the RAM arm is not vacuous on the cells that matter.
 *   8. TEETH — seven twins with exact catch counts over the crafted sweep. Two of them are caught
 *      on 21 of 768 crafted entries — exactly the cursors that wrap the loop counter — so the
 *      counts, not a blanket verdict, are what says the sweep reaches the arm they break.
 *
 * HOLE: the seeded list points its entries at colour-plane cells chosen here. Nothing says which
 * cells the game really queues, only that whatever address an entry carries is the one edited.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-52d2.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { paintDeferredCells } from "../paintDeferredCells.js";
import { loc_52d2 as oracle } from "../../translated/loc_52d2.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { DEFERRED_WRITE_CURSOR } from "../names.js";

const TARGET = 0x52d2;
const FRAMES = 1500;
const DISPATCHES = 1265;

const TINT_BIAS_CELL = 0xad0c;
const FIRST_ENTRY = 0xae04;
const ENTRY_BYTES = 4;
const TO_CHARACTER_PLANE = 0x0400;
const ABOVE_SPRITES = 0x10;

/**
 * The WHOLE page is seeded with well-formed entries, not just the few a small count reads. A
 * crafted cursor can leave a loop counter of zero, which runs the loop 256 times and walks the
 * read cursor round the page four times; with only a handful of entries planted the rest of the
 * page decodes as addresses in the program image and the frozen side throws on the write.
 */
const PAGE_SLOTS = 64;
const SEEDED_PLANE = 0xa100;
const SEEDED_HIGH = SEEDED_PLANE >> 8;
const SEEDED_SHAPE = 0x41;
const SEEDED_TINT = 0x03;
/** The slot the read cursor reaches first, and how many a four-entry list covers. */
const FIRST_SLOT = 1;
const LIST_ENTRIES = 4;
const LIST_CURSOR = 4 + LIST_ENTRIES * ENTRY_BYTES;
/** The last entry of that list is planted ALREADY above the sprites, so the skip branch is live. */
const PRIORITY_SLOT = FIRST_SLOT + LIST_ENTRIES - 1;
const cellOfSlot = (slot) => SEEDED_PLANE + slot;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["c", "l", "sp"];

const CURSORS = Array.from({ length: 256 }, (_unused, i) => i);
const BIASES = [0x00, 0x05, 0xff];
const SWEEP_SIZE = CURSORS.length * BIASES.length;

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

/**
 * A candidate that walks its read cursor out of the page eventually addresses the program image
 * and the write throws. That IS a divergence, so it is caught rather than allowed to abort the
 * sweep — the frozen side never throws here, which the EXHAUSTIVE arm's clean pass establishes.
 */
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
    cursors.add(mm.mem16[DEFERRED_WRITE_CURSOR] & 0xff);
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
  if (entry === null) replay(paintDeferredCells);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/**
 * A real captured machine with a list of four entries planted at the head of the page, the write
 * cursor forced, and the tint bias forced. The last seeded cell is left ALREADY above the sprites
 * so the skip branch is on the sweep as well as the paint branch.
 */
function craft(cursor, bias) {
  const m = entryState().clone();
  m.mem8[TINT_BIAS_CELL] = bias;
  for (let slot = 0; slot < PAGE_SLOTS; slot++) {
    const at = DEFERRED_WRITE_CURSOR + slot * ENTRY_BYTES;
    const cell = cellOfSlot(slot);
    m.mem8[at] = cell & 0xff;
    m.mem8[at + 1] = SEEDED_HIGH;
    m.mem8[at + 2] = (SEEDED_SHAPE + slot) & 0xff;
    m.mem8[at + 3] = (SEEDED_TINT + slot) & 0xff;
    m.mem8[cell] = slot === PRIORITY_SLOT ? ABOVE_SPRITES : 0;
    m.mem8[cell | TO_CHARACTER_PLANE] = 0;
  }
  m.mem8[DEFERRED_WRITE_CURSOR] = cursor; // only the low half is read; the high half stays a seeded entry byte
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const bias of BIASES) {
    for (const cursor of CURSORS) if (unitDiff(candidate, craft(cursor, bias))) caught++;
  }
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

const nextByte = (cursor) => (cursor & 0xff00) | ((cursor + 1) & 0xff);

function paint(m, o) {
  const opt = { bias: null, honourPriority: true, header: 4, forLoop: false, page: true, ...o };
  const { mem8, mem16 } = m;
  const bias = opt.bias === null ? mem8[TINT_BIAS_CELL] & 0x0f : opt.bias;
  const filled = (( mem16[DEFERRED_WRITE_CURSOR] & 0xff) - opt.header) & 0xff;
  if (filled === 0) return;
  let left = (filled >> 2) & 0x1f;
  if (opt.forLoop && left === 0) return;
  let cursor = FIRST_ENTRY;
  const step = opt.page ? nextByte : (c) => (c + 1) & 0xffff;
  do {
    const low = mem8[cursor];
    cursor = step(cursor);
    const cell = low | (mem8[cursor] << 8);
    cursor = step(cursor);
    if (!opt.honourPriority || (mem8[cell] & ABOVE_SPRITES) === 0) {
      mem8[cell | TO_CHARACTER_PLANE] = mem8[cursor];
      cursor = step(cursor);
      mem8[cell] = (mem8[cursor] + bias) & 0xff;
      cursor = step(cursor);
    } else {
      cursor = step(step(cursor));
    }
    left = (left - 1) & 0xff;
  } while (left !== 0);
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: drops the shared tint bias, so the whole list paints in the wrong colour. */
function brokenNoBias(m) {
  paint(m, { bias: 0 });
}

/** BUG: takes the whole bias cell instead of its low half. */
function brokenWholeBiasByte(m) {
  paint(m, { bias: m.mem8[TINT_BIAS_CELL] });
}

/** BUG: paints entries that are already above the sprites. */
function brokenIgnoresPriority(m) {
  paint(m, { honourPriority: false });
}

/** BUG: the header is one entry longer, so the count is short by one. */
function brokenHeader(m) {
  paint(m, { header: 8 });
}

/**
 * BUG: a plain counted loop instead of the hardware's decrement-and-test, so a count of zero
 * paints nothing where the original paints 256 entries. No real dispatch can tell this apart.
 */
function brokenForLoop(m) {
  paint(m, { forLoop: true });
}

/** BUG: the read cursor carries out of its page instead of wrapping inside it. */
function brokenLeavesPage(m) {
  paint(m, { page: false });
}

/** Each twin's exact catch count over the crafted sweep. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 765],
  ["no-bias", brokenNoBias, 510],
  ["whole-bias-byte", brokenWholeBiasByte, 255],
  ["ignores-priority", brokenIgnoresPriority, 693],
  ["header-too-long", brokenHeader, 744],
  ["for-loop", brokenForLoop, 21],
  ["cursor-leaves-page", brokenLeavesPage, 21],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: paintDeferredCells == oracle over the whole dump", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  paintDeferredCells(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: sp=${hex4(entryState().regs.sp)}, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(LIST_CURSOR, 0x05));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a pinned register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  paintDeferredCells(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded register set changed shape",
  );
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real session replays identically", { skip }, () => {
  const r = replay(paintDeferredCells);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  console.log(`  CORPUS: ${r.dispatches} dispatches, cursors ${[...r.cursors].sort((x, y) => x - y)}`);
});

test("EXHAUSTIVE: all 256 cursors against three tint biases", { skip }, () => {
  assert.equal(sweepCaught(paintDeferredCells), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} cursor x bias comparisons identical`);
});

test("THE COUNT THAT WRAPS: a cursor three past the header runs the loop round", { skip }, () => {
  const watched = cellOfSlot(FIRST_SLOT) | TO_CHARACTER_PLANE;
  const empty = craft(0x04, 0x05);
  const before = empty.mem8[watched];
  paintDeferredCells(empty);
  assert.equal(empty.mem8[watched], before, "a bare header paints nothing");

  const wraps = craft(0x07, 0x05);
  paintDeferredCells(wraps);
  assert.notEqual(
    wraps.mem8[watched],
    before,
    "a cursor of seven leaves a loop counter of zero, which must run the loop round rather than " +
      "skip it — if this ever stops being true the for-loop twin is unreachable and toothless",
  );
  console.log("  WRAPS: cursor 4 paints nothing; cursor 7 wraps the counter and paints");
});

test("THE EDITS LAND: shape and biased tint arrive in both planes", { skip }, () => {
  const bias = 0x05;
  const m = craft(LIST_CURSOR, bias);
  paintDeferredCells(m);
  for (let slot = FIRST_SLOT; slot < PRIORITY_SLOT; slot++) {
    const cell = cellOfSlot(slot);
    assert.equal(m.mem8[cell | TO_CHARACTER_PLANE], SEEDED_SHAPE + slot, `slot ${slot} shape`);
    assert.equal(m.mem8[cell], SEEDED_TINT + slot + bias, `slot ${slot} tint`);
  }
  const skipped = cellOfSlot(PRIORITY_SLOT);
  assert.equal(m.mem8[skipped | TO_CHARACTER_PLANE], 0, "the priority entry is untouched");
  assert.equal(m.mem8[skipped], ABOVE_SPRITES, "and keeps its colour byte");
  const past = cellOfSlot(PRIORITY_SLOT + 1);
  assert.equal(m.mem8[past | TO_CHARACTER_PLANE], 0, "the entry past the list must not be painted");
  console.log(`  LANDS: ${LIST_ENTRIES - 1} entries painted, 1 skipped for priority`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} crafted entries`);
  });
}
