// SPDX-License-Identifier: GPL-3.0-only
/**
 * driftWithWorldScroll — memory-equivalent to the frozen oracle at ROM 0x2B60.
 *
 * GATE: strict unit-capture PLUS crafted entries. The host game runs the coin -> start tape
 *   until 0x2B60 first dispatches (undriven attract reaches it too, later), and both arms run on
 *   independent clones of that pristine machine.
 *
 * LIVE-OUT is memory only, and that is derived from the CALLERS rather than from the
 *   instruction sequence: all eight resume with a memory load (`ld a,(iy+0x31)` or
 *   `ld a,(ix+0x00)`) or tail-jump to a pushed continuation, so no register or flag the
 *   routine leaves behind is ever consumed. RAM is therefore the whole contract — and the
 *   NOT VACUOUS test below proves the RAM diff is a real gate here rather than a tautology.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump.
 *   2. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY. Memory-equivalence drops the Z80
 *      register trace, so the oracle's address pairs, its flag update and its `ret` pop all
 *      diverge by design and `equal` is false for a CORRECT routine. The divergence is pinned
 *      to exactly {f, d, e, h, l, sp} plus pc so "excluded" cannot quietly widen.
 *   3. NARROW, and measured to be so. At the one dispatch the tape reaches, the second
 *      displacement is zero and the first is a whole 0x0100, so exactly ONE of the four
 *      written bytes actually moves. That is close to a blind gate, which is why (4) exists.
 *   4. CRAFTED ENTRIES — the real captured state with the two displacement cells and the four
 *      position bytes poked identically on both sides, over a cross of displacements
 *      (zero, carry-generating, sign-flipping, the two magnitudes the game itself uses) and
 *      positions (both ends of each byte). Plus an exhaustive 0..255 sweep of one fraction
 *      byte, which is the only way the carry into the whole byte gets covered.
 *   5. TEETH — five broken twins aimed at four different cells and at the carry. Each must
 *      FAIL the crafted comparison the real arm passes; only two of the five are catchable at
 *      the real dispatch, and the test asserts that split rather than glossing it.
 *
 * HOLE: one dispatch state, one object. Every dispatch in a driven run to the shared budget
 * comes from the same object slot, so the record bases are fixed; the crafted sweep varies
 * the values the routine actually reads, not the bases it reads them from.
 *
 * This routine has the LATEST first dispatch of its batch, so the shared ENTRY_FRAMES budget
 * reaching it is the binding case rather than an incidental one; the BUDGET test asserts it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2b60.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { driftWithWorldScroll } from "../driftWithWorldScroll.js";
import { loc_2b60 as oracle } from "../../translated/loc_2b60.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2b60;

const DISPLACEMENT_A = 0xa808;
const DISPLACEMENT_B = 0xa80a;

const skip = romsPresent() ? false : "ROM images are not assembled";

let entry = null;

/** The gate itself, with the entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(driftWithWorldScroll);
  return entry;
}

// The four bytes the routine writes, addressed off the two record bases the caller supplies.
const wholeA = (m) => (m.regs.iy + 49) & 0xffff;
const fractionA = (m) => (m.regs.ix + 3) & 0xffff;
const wholeB = (m) => m.regs.iy & 0xffff;
const fractionB = (m) => (m.regs.ix + 5) & 0xffff;

/** The real entry with both displacements and all four position bytes forced to `prior`. */
function craft(prior) {
  const m = entryState().clone();
  m.mem16[DISPLACEMENT_A] = prior.dA;
  m.mem16[DISPLACEMENT_B] = prior.dB;
  m.mem8[wholeA(m)] = prior.wA;
  m.mem8[fractionA(m)] = prior.fA;
  m.mem8[wholeB(m)] = prior.wB;
  m.mem8[fractionB(m)] = prior.fB;
  return m;
}

function craftedDiff(candidate, prior) {
  const a = craft(prior);
  const b = craft(prior);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// Zero, +1, a low-byte-only step, a whole step, the two magnitudes the game's own drift uses,
// and the sign extremes. 0xffff and 0xfe80 are negative displacements.
const DISPLACEMENTS = [0x0000, 0x0001, 0x00ff, 0x0100, 0x0180, 0x7fff, 0x8000, 0xfe80, 0xffff];

const POSITIONS = [
  { wA: 0, fA: 0, wB: 0, fB: 0 },
  { wA: 0, fA: 255, wB: 255, fB: 0 },
  { wA: 255, fA: 255, wB: 255, fB: 255 },
  { wA: 138, fA: 203, wB: 129, fB: 88 },
  { wA: 1, fA: 1, wB: 254, fB: 254 },
];

function craftedPriors() {
  const out = [];
  for (const dA of DISPLACEMENTS) {
    for (const dB of DISPLACEMENTS) {
      for (const p of POSITIONS) out.push({ ...p, dA, dB });
    }
  }
  return out;
}

/** One fraction byte swept 0..255 with a +1 step, so the carry into the whole byte is hit. */
function carryPriors() {
  const out = [];
  for (let f = 0; f < 256; f++) out.push({ wA: 200, fA: f, wB: 7, fB: f, dA: 1, dB: 0xffff });
  return out;
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: driftWithWorldScroll == oracle on RAM", { skip }, () => {
  const r = gate(driftWithWorldScroll);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const e = entryState();
  console.log(
    `  EQUAL: entry bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} within ${ENTRY_FRAMES} ` +
      "frames; RAM identical",
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the RAM diff at the real dispatch", { skip }, () => {
  const r = gate(() => {});
  assert.notEqual(
    r.ram,
    null,
    "the RAM diff passed a candidate that does nothing, so RAM is NOT this gate — the " +
      "routine's effect would have to be registers and the whole file must be re-derived",
  );
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(r.ram)}`);
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  driftWithWorldScroll(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    ["f", "d", "e", "h", "l", "sp"],
    "the excluded set changed shape: only the flag byte, the two address pairs the oracle " +
      "assembles its arithmetic in, and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  for (const at of [wholeA, fractionA, wholeB, fractionB]) {
    assert.equal(a.mem8[at(a)], b.mem8[at(b)], `live-out ${hex4(at(a))}`);
  }
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("NARROW: the real dispatch moves only one of the four bytes", { skip }, () => {
  const before = entryState();
  const after = before.clone();
  oracle(after);

  const dB = before.mem16[DISPLACEMENT_B];
  assert.equal(dB, 0, "the second displacement is zero here — the crafted sweep must cover it");
  const bytes = [wholeA, fractionA, wholeB, fractionB];
  const changed = bytes.filter((at) => before.mem8[at(before)] !== after.mem8[at(after)]);
  assert.equal(changed.length, 1, "one byte, so the natural dispatch is a nearly blind gate");
  console.log(
    `  NARROW: displacements ${hex4(before.mem16[DISPLACEMENT_A])}/${hex4(dB)}; ` +
      `${changed.length} of ${bytes.length} written bytes move`,
  );
});

test("CRAFTED: every displacement x position combination steps as the oracle steps it", { skip }, () => {
  const priors = craftedPriors();
  for (const p of priors) {
    const d = craftedDiff(driftWithWorldScroll, p);
    assert.equal(d, null, `${JSON.stringify(p)}: ${show(d)}`);
  }
  assert.equal(priors.length, DISPLACEMENTS.length ** 2 * POSITIONS.length, "sweep shrank");
  console.log(`  CRAFTED: ${priors.length} entries identical`);
});

test("CARRY: a fraction swept 0..255 carries into the whole byte exactly as the oracle does", { skip }, () => {
  const priors = carryPriors();
  for (const p of priors) {
    const d = craftedDiff(driftWithWorldScroll, p);
    assert.equal(d, null, `fraction=${p.fA}: ${show(d)}`);
  }

  const wrapped = craft({ wA: 255, fA: 255, wB: 0, fB: 0, dA: 1, dB: 0 });
  driftWithWorldScroll(wrapped);
  assert.equal(wrapped.mem8[wholeA(wrapped)], 0, "the whole byte must round, not widen");
  assert.equal(wrapped.mem8[fractionA(wrapped)], 0, "the fraction must round too");
  console.log(`  CARRY: ${priors.length} fractions identical, including the 0xFFFF -> 0 wrap`);
});

test("BUDGET: the shared entry budget reaches this routine, the batch's latest", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, "the shared budget reached the routine but the two arms disagreed");
  console.log(`  BUDGET: ${ENTRY_FRAMES} shared frames reach the routine`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin below is a plausible way to get this
// routine wrong, aimed at a DIFFERENT written byte or at the carry between them, and each
// must be caught by the same crafted comparison the real arm passes.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: stores the whole bytes but never the two fraction bytes, so sub-steps never bank. */
function brokenWholeOnly(m) {
  const { mem8 } = m;
  mem8[wholeA(m)] = ((mem8[wholeA(m)] << 8) + mem8[fractionA(m)] + m.mem16[DISPLACEMENT_A]) >> 8;
  mem8[wholeB(m)] = ((mem8[wholeB(m)] << 8) + mem8[fractionB(m)] + m.mem16[DISPLACEMENT_B]) >> 8;
}

/** BUG: drifts the first coordinate and forgets the second one entirely. */
function brokenSecondSkipped(m) {
  const { mem8 } = m;
  const moved = (mem8[wholeA(m)] << 8) + mem8[fractionA(m)] + m.mem16[DISPLACEMENT_A];
  mem8[wholeA(m)] = moved >> 8;
  mem8[fractionA(m)] = moved;
}

/** BUG: adds each displacement byte to its own half, so a fraction overflow never carries. */
function brokenNoCarry(m) {
  const { mem8 } = m;
  const dA = m.mem16[DISPLACEMENT_A];
  const dB = m.mem16[DISPLACEMENT_B];
  mem8[wholeA(m)] = mem8[wholeA(m)] + (dA >> 8);
  mem8[fractionA(m)] = mem8[fractionA(m)] + (dA & 0xff);
  mem8[wholeB(m)] = mem8[wholeB(m)] + (dB >> 8);
  mem8[fractionB(m)] = mem8[fractionB(m)] + (dB & 0xff);
}

/** BUG: feeds each coordinate the other coordinate's displacement. */
function brokenSwapped(m) {
  const { mem8 } = m;
  let moved = (mem8[wholeA(m)] << 8) + mem8[fractionA(m)] + m.mem16[DISPLACEMENT_B];
  mem8[wholeA(m)] = moved >> 8;
  mem8[fractionA(m)] = moved;
  moved = (mem8[wholeB(m)] << 8) + mem8[fractionB(m)] + m.mem16[DISPLACEMENT_A];
  mem8[wholeB(m)] = moved >> 8;
  mem8[fractionB(m)] = moved;
}

// label -> [twin, a prior guaranteed to discriminate it, catchable at the real dispatch?]
const TWINS = [
  ["no-op", brokenNoOp, { wA: 0, fA: 0, wB: 0, fB: 0, dA: 1, dB: 1 }, true],
  ["whole-only", brokenWholeOnly, { wA: 0, fA: 0, wB: 0, fB: 0, dA: 1, dB: 1 }, false],
  ["second-skipped", brokenSecondSkipped, { wA: 0, fA: 0, wB: 0, fB: 0, dA: 0, dB: 0x0180 }, false],
  ["no-carry", brokenNoCarry, { wA: 0, fA: 255, wB: 0, fB: 0, dA: 1, dB: 0 }, false],
  ["swapped", brokenSwapped, { wA: 0, fA: 0, wB: 0, fB: 0, dA: 0x0180, dB: 0xfe80 }, true],
];

for (const [label, twin, discriminator, caughtAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT by a crafted entry`, { skip }, () => {
    const d = craftedDiff(twin, discriminator);
    assert.notEqual(d, null, `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${show(d)}`);
  });

  test(`TEETH: the ${label} twin is CAUGHT across the crafted sweep`, { skip }, () => {
    const priors = craftedPriors();
    const caught = priors.filter((p) => craftedDiff(twin, p) !== null).length;
    assert.ok(caught > 0, `the sweep missed the ${label} twin on every one of its entries`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${priors.length} crafted entries`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const r = gate(twin);
    assert.equal(
      r.ram !== null,
      caughtAtDispatch,
      `the real dispatch's blindness to the ${label} twin changed — re-derive the holes`,
    );
    console.log(
      `  TEETH/${label}: real dispatch ${r.ram ? `caught — ${show(r.ram)}` : "BLIND, as recorded"}`,
    );
  });
}
