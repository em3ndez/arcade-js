// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequenceSubStep — memory-equivalent to the frozen oracle at ROM 0x0F1A.
 *
 * GATE: strict unit-capture, straight through unitEquivalence. The entry state is the real
 *   one: the host game runs the coin -> start tape until 0x0F1A first dispatches (undriven
 *   attract reaches it too, later), and both arms then run on independent clones of it.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump.
 *   2. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY. The memory-equivalence contract drops
 *      the Z80 register trace, so the oracle's address load, its flag update and its `ret`
 *      pop all diverge by design, and `equal` is therefore false for a CORRECT routine.
 *      The test bounds the divergence to {f, h, l, sp} plus pc and asserts nothing else
 *      moved, so "excluded" cannot quietly widen. A rewrite that clobbers FEWER of them
 *      is an improvement and stays green.
 *   3. EXHAUSTIVE over priors — the target cell swept 0..255 on the real entry, which is
 *      the only way the 255 -> 0 wrap gets covered (the captured entry holds a low value).
 *   4. TEETH — three broken twins, each of which must FAIL the same comparison.
 *
 * HOLE: one dispatch state. The routine reads only the cell it writes, so the prior sweep
 * covers its whole input space; the rest of the machine is fixed at the captured entry.
 *
 * The pristine entry the sweep needs is HARVESTED from the gate rather than captured a
 * second time: unitEquivalence hands the candidate arm a fresh clone of the entry, so
 * cloning it there costs nothing and keeps one capture path in this file, not two.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0f1a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { SEQUENCE_SUBSTEP } from "../names.js";
import { loc_0f1a as oracle } from "../../translated/loc_0f1a.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x0f1a;

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
  if (entry === null) gate(advanceSequenceSubStep);
  return entry;
}

/** Oracle vs candidate from the real entry, with the target cell forced to `prior`. */
function sweepDiff(candidate, prior) {
  const a = entryState().clone();
  const b = entryState().clone();
  a.mem8[SEQUENCE_SUBSTEP] = prior;
  b.mem8[SEQUENCE_SUBSTEP] = prior;
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: advanceSequenceSubStep == oracle on RAM", { skip }, () => {
  const r = gate(advanceSequenceSubStep);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  console.log(
    `  EQUAL: entry ${hex4(SEQUENCE_SUBSTEP)}=${entryState().mem8[SEQUENCE_SUBSTEP]} within ` +
      `${ENTRY_FRAMES} frames; RAM identical`,
  );
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  advanceSequenceSubStep(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !["f", "h", "l", "sp"].includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set: only the flag byte, the address register " +
      "pair and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.mem8[SEQUENCE_SUBSTEP], b.mem8[SEQUENCE_SUBSTEP], "the one live-out");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("EXHAUSTIVE over priors: every value 0..255 steps as the oracle steps it", { skip }, () => {
  let swept = 0;
  for (let prior = 0; prior < 256; prior++) {
    const d = sweepDiff(advanceSequenceSubStep, prior);
    assert.equal(d, null, `prior=${prior}: ${show(d)}`);
    swept++;
  }
  assert.equal(swept, 256, "must have swept every prior");

  const wrapped = entryState().clone();
  wrapped.mem8[SEQUENCE_SUBSTEP] = 255;
  advanceSequenceSubStep(wrapped);
  assert.equal(wrapped.mem8[SEQUENCE_SUBSTEP], 0, "255 must round to 0, not widen to 256");
  console.log(`  EXHAUSTIVE: ${swept} priors identical, including the 255 -> 0 wrap`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless, so each twin below is a plausible way to get this
// routine wrong and each must be caught by the SAME comparison the real arm passes.

/** BUG: steps by two. */
function brokenStepsTwice(m) {
  const { mem8 } = m;
  mem8[SEQUENCE_SUBSTEP] = mem8[SEQUENCE_SUBSTEP] + 2;
}

/** BUG: steps the cell below the target, leaving the target untouched. */
function brokenWrongCell(m) {
  const { mem8 } = m;
  const addr = (SEQUENCE_SUBSTEP - 1) & 0xffff;
  mem8[addr] = mem8[addr] + 1;
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

for (const [label, twin] of [
  ["steps-by-two", brokenStepsTwice],
  ["wrong-cell", brokenWrongCell],
  ["no-op", brokenNoOp],
]) {
  test(`TEETH: the ${label} twin is CAUGHT by unitEquivalence`, { skip }, () => {
    const r = gate(twin);
    assert.notEqual(r.ram, null, `the gate PASSED the ${label} twin — it has no teeth`);
    assert.equal(r.equal, false, "a RAM divergence must fail the whole comparison");
    console.log(`  TEETH/${label}: caught — ${show(r.ram)}`);
  });

  test(`TEETH: the ${label} twin is CAUGHT across every prior`, { skip }, () => {
    let caught = 0;
    for (let prior = 0; prior < 256; prior++) if (sweepDiff(twin, prior)) caught++;
    assert.equal(caught, 256, `the sweep missed the ${label} twin on ${256 - caught} prior(s)`);
    console.log(`  TEETH/${label}: caught on all ${caught} priors`);
  });
}
