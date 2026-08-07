// SPDX-License-Identifier: GPL-3.0-only
/**
 * hideCaptionSprites — memory-equivalent to the frozen oracle at ROM 0x0B2B.
 *
 * ★ WHERE THE REAL BACKDROP IS BLIND, MEASURED RATHER THAN ASSUMED. The routine's whole effect
 *   is four zero-stores. At the real entry all four target cells happen to be NON-zero, so the
 *   raw backdrop does catch a candidate that does nothing — but most of the cells AROUND them
 *   already read zero, so a candidate storing in the wrong place there writes zero over zero and
 *   is invisible. Arm 2 counts both, and the teeth arms record, per twin, whether the raw
 *   backdrop sees it or only the painted band does.
 *
 * GATE: real capture on two tapes, plus painted crafted entries. What it exercises:
 *
 *   1. EQUAL at the real dispatch on both tapes — whole state dump identical.
 *   2. THE BACKDROP, MEASURED — how many target cells are non-zero and how many band cells are.
 *   3. REGISTERS ARE EXCLUDED, DELIBERATELY, and the excluded set is pinned. The oracle walks
 *      the run with a pointer, a stride and a counter and the rewrite does not, so those move;
 *      all three callers reload before reading any of them, which is why they are dropped.
 *   4. THE RUN LANDS — over a painted band, exactly four cells go to zero and they are the four
 *      this file names, so the RAM arm is demonstrably not vacuous on the cells that matter.
 *   5. PAINTED CRAFTED ENTRIES — the band poisoned with an address-derived marker.
 *   6. TEETH — six twins, each caught inside the painted band, with its raw verdict pinned too.
 *
 * HOLE: one dispatch per tape, and nothing here says what the four slots are for or who reads
 * them. The band painted is nine cells either side of the run, so a twin writing far outside it
 * would be caught by the whole-dump comparison but is not specifically covered.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0b2b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { hideCaptionSprites } from "../hideCaptionSprites.js";
import { loc_0b2b as oracle } from "../../translated/loc_0b2b.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0b2b;

const FIRST_SLOT = 0xaa41;
const SLOT_STRIDE = 2;
const SLOTS = 4;
const CLEARED = [0, 1, 2, 3].map((i) => FIRST_SLOT + i * SLOT_STRIDE);

/** How far either side of the run the marker is laid down. */
const PAINT_EITHER_SIDE = 9;

const DISPATCHES = { shared: 1, attract: 1 };
const TAPES = [["shared", {}], ["attract", { tape: [] }]];

/** Everything the oracle's own walk leaves behind; every caller reloads before reading. */
const EXCLUDED = ["a", "f", "b", "d", "e", "h", "l", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function firstDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

let corpusCache = null;
function corpus() {
  if (corpusCache) return corpusCache;
  corpusCache = TAPES.map(([label, opts]) => {
    const states = [];
    const host = makeMachine(new Map([[TARGET, (mm) => (states.push(mm.clone()), oracle(mm))]]), opts);
    const frames = host.runFrames(ENTRY_FRAMES);
    assert.equal(host.stoppedBy, null, `the ${label} session stopped early: ${host.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
    assert.equal(states.length, DISPATCHES[label], `the ${label} dispatch count moved`);
    return { label, states };
  });
  return corpusCache;
}

const anEntry = () => corpus()[0].states[0];

/** A non-zero marker derived from the address, so no two painted bytes collide. */
const marker = (addr) => ((addr & 0xff) ^ 0x5a) || 0x5a;

/** Every address the band covers: the run plus a margin either side. */
function bandCells() {
  const last = FIRST_SLOT + (SLOTS - 1) * SLOT_STRIDE;
  const out = [];
  for (let a = FIRST_SLOT - PAINT_EITHER_SIDE; a <= last + PAINT_EITHER_SIDE; a++) out.push(a);
  return out;
}

function painted() {
  const m = anEntry().clone();
  for (const a of bandCells()) m.mem8[a] = marker(a);
  return m;
}

function compare(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstDiff(a, b);
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch, on both tapes", { skip }, () => {
  for (const s of corpus()) {
    assert.ok(s.states.length > 0, `vacuous: the ${s.label} tape never reached the routine`);
    for (const state of s.states) {
      const d = compare(hideCaptionSprites, state);
      assert.equal(d, null, `${s.label}: ${show(d)}`);
    }
  }
  console.log(`  EQUAL: ${corpus().map((s) => `${s.label} ${s.states.length}`).join(", ")} dispatches`);
});

test("THE BACKDROP, MEASURED: the run is visible raw, its surroundings are not", { skip }, () => {
  const live = CLEARED.filter((a) => anEntry().mem8[a] !== 0);
  assert.deepEqual(live, CLEARED, "a target cell already reads zero, so a no-op now survives raw");
  const blindNeighbours = bandCells().filter((a) => !CLEARED.includes(a) && anEntry().mem8[a] === 0);
  assert.ok(
    blindNeighbours.length > 0,
    "every cell around the run is non-zero too, so the raw backdrop would catch a misplaced " +
      "store as well and this file's reason for painting the band is stale",
  );
  const d = compare(brokenNoOp, anEntry());
  assert.notEqual(d, null, "the raw backdrop passed a no-op");
  console.log(
    `  BACKDROP: all ${SLOTS} target cells non-zero (a no-op is caught raw at ${show(d)}); ` +
      `${blindNeighbours.length} of ${bandCells().length - SLOTS} band neighbours already zero`,
  );
});

test("EXCLUDED, deliberately: the walk's registers and the stack pointer, and nothing else", { skip }, () => {
  const a = anEntry().clone();
  const b = anEntry().clone();
  oracle(a);
  hideCaptionSprites(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.ok(moved.every((k) => EXCLUDED.includes(k)), `a register outside the set moved: ${moved}`);
  assert.ok(moved.includes("sp"), "the oracle returns, so the stack pointer must move");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc`);
});

test("THE RUN LANDS: over a painted band exactly the four named cells go to zero", { skip }, () => {
  const after = painted();
  oracle(after);
  const zeroed = bandCells().filter((a) => after.mem8[a] !== marker(a));
  assert.deepEqual(zeroed, CLEARED, "the oracle's write-set inside the band is not the named run");
  assert.ok(zeroed.every((a) => after.mem8[a] === 0), "a cell in the run holds something but zero");
  console.log(`  LANDS: ${zeroed.map(hex4).join(" ")} — and nothing else inside the band`);
});

test("PAINTED CRAFTED ENTRY: with every cell of the band visible, the two agree", { skip }, () => {
  const d = compare(hideCaptionSprites, painted());
  assert.equal(d, null, `the rewrite diverged over the painted band — ${show(d)}`);
  console.log(`  PAINTED: band of ${bandCells().length} cells identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: clears consecutive cells rather than every second one. */
function brokenStride(m) {
  for (let i = 0; i < SLOTS; i++) m.mem8[FIRST_SLOT + i] = 0;
}

/** BUG: stops one slot short. */
function brokenShort(m) {
  for (let i = 0; i < SLOTS - 1; i++) m.mem8[FIRST_SLOT + i * SLOT_STRIDE] = 0;
}

/** BUG: runs one slot too far. */
function brokenLong(m) {
  for (let i = 0; i < SLOTS + 1; i++) m.mem8[FIRST_SLOT + i * SLOT_STRIDE] = 0;
}

/** BUG: starts one cell along, so it clears each slot's other byte. */
function brokenFirstSlot(m) {
  for (let i = 0; i < SLOTS; i++) m.mem8[FIRST_SLOT + 1 + i * SLOT_STRIDE] = 0;
}

/** BUG: writes a value that is not zero. */
function brokenNonZero(m) {
  for (let i = 0; i < SLOTS; i++) m.mem8[FIRST_SLOT + i * SLOT_STRIDE] = 1;
}

/** Whether the RAW backdrop sees a twin, measured per twin rather than assumed. */
const RAW_VERDICTS = {
  "no-op": true,
  "consecutive-not-strided": true,
  "one-slot-short": true,
  "one-slot-too-far": false,
  "off-by-one-first-slot": true,
  "writes-one-not-zero": true,
};

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["consecutive-not-strided", brokenStride],
  ["one-slot-short", brokenShort],
  ["one-slot-too-far", brokenLong],
  ["off-by-one-first-slot", brokenFirstSlot],
  ["writes-one-not-zero", brokenNonZero],
]) {
  test(`TEETH: the ${label} twin is CAUGHT inside the painted band`, { skip }, () => {
    const d = compare(twin, painted());
    assert.notEqual(d, null, `the painted comparison PASSED the ${label} twin`);
    const band = bandCells();
    assert.ok(
      d.addr >= band[0] && d.addr <= band[band.length - 1],
      `the ${label} twin diverges first at ${hex4(d.addr)}, outside the painted band`,
    );
    const rawSeesIt = compare(twin, anEntry()) !== null;
    assert.equal(rawSeesIt, RAW_VERDICTS[label], `the raw backdrop's verdict on ${label} moved`);
    console.log(
      `  TEETH/${label}: caught — ${show(d)}; the raw backdrop ` +
        `${rawSeesIt ? "sees it too" : "is BLIND to it, which is why the band is painted"}`,
    );
  });
}
