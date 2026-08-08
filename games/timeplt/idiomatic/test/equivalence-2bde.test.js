// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireSlotAndSubPixel — memory-equivalent to the frozen oracle at ROM 0x2BDE.
 *
 * GATE: crafted-entry, because the strict one is BLIND here and this file proves it.
 *   The coin -> start tape does reach 0x2BDE, at frame 612, inside the harness budget —
 *   but that first dispatch is a round-init sweep over seven slots whose five target
 *   cells are ALREADY ZERO. The routine writes nothing there, so unitEquivalence returns
 *   ram: null for the real arm, for a wrong-offset twin, and for a bare no-op alike. The
 *   BLIND test asserts that tautology outright: if 0x2BDE ever does write memory at the
 *   captured entry, it fails loudly instead of the gate quietly becoming real.
 *
 * LIVE-OUT is memory, derived from the CALLERS rather than the opcodes. Seven of the
 *   eight reach 0x2BDE as a TAIL transfer, so its `ret` lands in loc_28A1, which calls
 *   the slot stubs one after another and consumes neither A nor the flags; the eighth,
 *   loc_19F0, follows its `call` with `ld de,0x0010 / add ix,de`, overwriting both. A, F
 *   and SP are dead at every caller, so the five cells are the entire effect.
 *
 * Every arm with teeth paints the captured entry first: the values a live object really
 *   holds at a despawn (measured at frame 1113 — slot 0xA890 = 9/203/88, sprite 0xAA22 =
 *   129 and 0xAA53 = 160) into the five targets, and a distinct non-zero marker into
 *   every neighbouring cell. A missed store then leaves a live value standing and a
 *   stray store blanks a marker, so both directions of error diverge.
 *
 *   1. BLIND     — the strict capture, asserted vacuous, the no-op proving it.
 *   2. DISPATCHED— the tape reaches the routine within ENTRY_FRAMES; the entry is real.
 *   3. EXCLUDED  — A, F, SP and pc diverge by design; the moved set is bounded by those three.
 *   4. CRAFTED   — identical on every (slot, sprite) pair the two tables carry.
 *   5. PRIORS    — the five cells swept 0..255. The routine reads nothing, so with the
 *                  base sweep above that is its whole input space.
 *   6. TEETH     — four broken twins, each caught by the arm-4 comparison.
 *
 * HOLE: one captured machine. Only the two base pointers and the five cells are varied;
 * the rest of RAM is whatever frame 612 left.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2bde.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { retireSlotAndSubPixel } from "../retireSlotAndSubPixel.js";
import { loc_2bde as oracle } from "../../translated/loc_2bde.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2bde;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SLOT_BYTES = 16;
const SPRITE_NEIGHBOURS = [-2, -1, 0, 1, 2, 47, 48, 49, 50, 51];
const LIVE_SLOT = [[0, 9], [3, 203], [5, 88]];
const LIVE_SPRITE = [[0, 129], [49, 160]];

/** Every (object slot, sprite entry) pair the two parallel tables can name. */
const PAIRS = [];
for (let k = 0; k <= 21; k++) PAIRS.push([0xa800 + 16 * k, 0xaa10 + 2 * k]);

let entry = null;

/** The strict gate, with the pristine entry harvested off the candidate arm's clone. */
function strict(candidate) {
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
  if (entry === null) strict(retireSlotAndSubPixel);
  return entry;
}

const marker = (off) => ((off * 37 + 11) & 0xff) | 1;

/** Load one machine with a live object in `slot`/`sprite`, ringed by markers. */
function paint(mm, slot, sprite, prior) {
  for (let i = 0; i < SLOT_BYTES; i++) mm.mem8[slot + i] = marker(i);
  for (const d of SPRITE_NEIGHBOURS) mm.mem8[sprite + d] = marker(d + 64);
  for (const [d, v] of LIVE_SLOT) mm.mem8[slot + d] = prior ?? v;
  for (const [d, v] of LIVE_SPRITE) mm.mem8[sprite + d] = prior ?? v;
  mm.regs.ix = slot;
  mm.regs.iy = sprite;
}

/** Oracle vs candidate on two painted clones of the captured entry. */
function craftedDiff(candidate, slot, sprite, prior) {
  const a = entryState().clone();
  const b = entryState().clone();
  paint(a, slot, sprite, prior);
  paint(b, slot, sprite, prior);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── broken twins ────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each of these is a plausible way to get the
// routine wrong, and each must be CAUGHT by the comparison the real arm passes.

/** BUG: does nothing. The twin that proves the comparison sees a real dispatch. */
function brokenNoOp() {}

/** BUG: frees the slot but leaves the sprite entry where it was, so the object stays drawn. */
function brokenKeepsSprite(m, slot = m.regs.ix) {
  m.mem8[slot] = 0;
  m.mem8[slot + 3] = 0;
  m.mem8[slot + 5] = 0;
}

/** BUG: clears the wrong remainder — offset 4 instead of 3. */
function brokenWrongRemainder(m, slot = m.regs.ix, sprite = m.regs.iy) {
  m.mem8[slot] = 0;
  m.mem8[slot + 4] = 0;
  m.mem8[slot + 5] = 0;
  m.mem8[sprite] = 0;
  m.mem8[sprite + 49] = 0;
}

/** BUG: stores 1 rather than 0, so the slot still reads as occupied. */
function brokenStoresOne(m, slot = m.regs.ix, sprite = m.regs.iy) {
  m.mem8[slot] = 1;
  m.mem8[slot + 3] = 1;
  m.mem8[slot + 5] = 1;
  m.mem8[sprite] = 1;
  m.mem8[sprite + 49] = 1;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["keeps-sprite", brokenKeepsSprite],
  ["wrong-remainder", brokenWrongRemainder],
  ["stores-one", brokenStoresOne],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("BLIND: the strict capture is VACUOUS here — a no-op passes it", { skip }, () => {
  const real = strict(retireSlotAndSubPixel);
  assert.equal(real.ram, null, `RAM diverged on the real arm — ${show(real.ram)}`);

  const e = entryState();
  const cells = [e.regs.ix, e.regs.ix + 3, e.regs.ix + 5, e.regs.iy, e.regs.iy + 49];
  const values = cells.map((c) => e.mem8[c]);
  assert.deepEqual(
    values,
    [0, 0, 0, 0, 0],
    "the captured entry no longer has all five targets zero — the strict gate may now " +
      "have teeth, so re-derive this file rather than trusting the crafted arms alone",
  );
  assert.equal(
    strict(brokenNoOp).ram,
    null,
    "the no-op is now CAUGHT by the strict gate — that is good news, but this test " +
      "documents the opposite and must be rewritten",
  );
  console.log(`  BLIND: ${cells.map(hex4).join(" ")} all zero at entry; no-op passes`);
});

test("DISPATCHED: the tape reaches the routine inside the harness budget", { skip }, () => {
  const e = entryState();
  assert.notEqual(e, null, `vacuous: 0x2bde never entered within ${ENTRY_FRAMES} frames`);
  const pair = PAIRS.some(([s, p]) => s === e.regs.ix && p === e.regs.iy);
  assert.ok(pair, `entry bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} are not a table pair`);
  console.log(`  DISPATCHED: slot ${hex4(e.regs.ix)}, sprite ${hex4(e.regs.iy)}`);
});

test("EXCLUDED, deliberately: A, F, SP and pc move and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  paint(a, 0xa890, 0xaa22);
  paint(b, 0xa890, 0xaa22);
  for (const mm of [a, b]) {
    mm.regs.a = 0x5a;
    mm.regs.f = 0;
  }
  oracle(a);
  retireSlotAndSubPixel(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !["a", "f", "sp"].includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(firstStateDiff(a.dumpState(), b.dumpState()), null, "RAM must still agree");
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc — dead at every caller`);
});

test("CRAFTED: identical on every slot the two tables carry", { skip }, () => {
  for (const [slot, sprite] of PAIRS) {
    const d = craftedDiff(retireSlotAndSubPixel, slot, sprite);
    assert.equal(d, null, `slot ${hex4(slot)}: ${show(d)}`);

    const after = entryState().clone();
    paint(after, slot, sprite);
    oracle(after);
    const targets = [slot, slot + 3, slot + 5, sprite, sprite + 49];
    assert.deepEqual(targets.map((c) => after.mem8[c]), [0, 0, 0, 0, 0], "not zeroed");
    assert.equal(after.mem8[slot + 4], marker(4), "the neighbouring cell must survive");
  }
  console.log(`  CRAFTED: ${PAIRS.length} slot/sprite pairs identical, each really cleared`);
});

test("PRIORS: every value 0..255 in the five cells clears the same way", { skip }, () => {
  let swept = 0;
  for (let prior = 0; prior < 256; prior++) {
    const d = craftedDiff(retireSlotAndSubPixel, 0xa8f0, 0xaa2e, prior);
    assert.equal(d, null, `prior=${prior}: ${show(d)}`);
    swept++;
  }
  assert.equal(swept, 256, "must have swept every prior");
  console.log(`  PRIORS: ${swept} priors identical`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on every pair`, { skip }, () => {
    let caught = 0;
    let sample = null;
    for (const [slot, sprite] of PAIRS) {
      const d = craftedDiff(twin, slot, sprite);
      if (d) {
        caught++;
        sample = sample ?? d;
      }
    }
    assert.equal(caught, PAIRS.length, `the ${label} twin slipped through ${PAIRS.length - caught}`);
    console.log(`  TEETH/${label}: caught on all ${caught} pairs — ${show(sample)}`);
  });
}

test("TEETH: the strict gate is wired, not dead — it catches a non-zero store", { skip }, () => {
  const r = strict(brokenStoresOne);
  assert.notEqual(r.ram, null, "even a store of 1 slipped through: the strict gate is dead");
  console.log(`  TEETH/strict: stores-one caught by unitEquivalence — ${show(r.ram)}`);
});
