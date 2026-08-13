// SPDX-License-Identifier: GPL-3.0-only
/**
 * trampolineToAdvanceSequenceSubStep — memory-equivalent to the frozen oracle at ROM 0x17FB.
 *
 * GATE: unit-capture through unitEquivalence on a REAL dispatch, plus an exhaustive 0..255 sweep of
 *   the one cell the routine touches. Three bytes, `jp 0x0F1A`; 0x0F1A is already decompiled as
 *   advanceSequenceSubStep, so the transfer is dissolved into a direct call and the gate proves that
 *   dissolve faithful.
 *
 * Tape is UNDRIVEN ATTRACT, not the shared coin -> start tape — a measurement: 0x17FB has no
 *   transfer site in the image (entry eleven of the inline word table after `rst 0x30` at 0x1658,
 *   dispatched on SEQUENCE_SUBSTEP), and attract reaches it at frame 789 while the coin -> start
 *   tape does not reach it until frame 3074, past the shared budget.
 *
 * Holes stated: RAM is byte-identical at the real dispatch; registers and pc are EXCLUDED
 *   deliberately (memory-equivalence drops the register trace, divergence bounded by {f,h,l,sp}+pc
 *   so "excluded" cannot widen); the cell is swept 0..255 to cover the 255 -> 0 wrap; teeth are a
 *   no-op, a steps-by-two and a wrong-cell twin, each caught by the capture arm and every prior.
 *   One dispatch state is enough — the routine reads only the cell it writes; nothing here
 *   establishes WHICH sequence the index steps.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-17fb.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { trampolineToAdvanceSequenceSubStep } from "../trampolineToAdvanceSequenceSubStep.js";
import { loc_17fb as oracle } from "../../translated/loc_17fb.js";
import { SEQUENCE_SUBSTEP } from "../names.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x17fb;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const attract = (overrides) => makeMachine(overrides, { tape: [] });

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    attract,
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
  if (entry === null) gate(trampolineToAdvanceSequenceSubStep);
  return entry;
}

/** Oracle against a candidate from the real entry, with the stepped cell forced to `prior`. */
function sweepDiff(candidate, prior) {
  const a = entryState().clone();
  const b = entryState().clone();
  a.mem8[SEQUENCE_SUBSTEP] = prior;
  b.mem8[SEQUENCE_SUBSTEP] = prior;
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: trampolineToAdvanceSequenceSubStep == oracle on RAM", { skip: SKIP }, () => {
  const r = gate(trampolineToAdvanceSequenceSubStep);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  console.log(
    `  EQUAL: entry ${hex4(SEQUENCE_SUBSTEP)}=${entryState().mem8[SEQUENCE_SUBSTEP]}; RAM identical`,
  );
});

test("THE SHARED TAPE DOES NOT REACH IT, and that is why attract is used", { skip: SKIP }, () => {
  let hits = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => { hits += 1; return oracle(mm); }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(hits, 0, "if the shared coin -> start tape now reaches it, this gate should use it");
  console.log(`  TAPE: the shared coin -> start tape dispatches it ${hits} times in the budget`);
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip: SKIP }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  trampolineToAdvanceSequenceSubStep(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !["f", "h", "l", "sp"].includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set: only the flag byte, the address register " +
      "pair and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the frozen original's return moves pc; the rewrite returns to JS");
  assert.equal(a.mem8[SEQUENCE_SUBSTEP], b.mem8[SEQUENCE_SUBSTEP], "the one live-out");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("EXHAUSTIVE over priors: every value 0..255 steps as the original steps it", { skip: SKIP }, () => {
  let swept = 0;
  for (let prior = 0; prior < 256; prior++) {
    const d = sweepDiff(trampolineToAdvanceSequenceSubStep, prior);
    assert.equal(d, null, `prior=${prior}: ${show(d)}`);
    swept++;
  }
  assert.equal(swept, 256, "must have swept every prior");

  const wrapped = entryState().clone();
  wrapped.mem8[SEQUENCE_SUBSTEP] = 255;
  trampolineToAdvanceSequenceSubStep(wrapped);
  assert.equal(wrapped.mem8[SEQUENCE_SUBSTEP], 0, "255 must round to 0, not widen to 256");
  console.log(`  EXHAUSTIVE: ${swept} priors identical, including the 255 -> 0 wrap`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

/** BUG: swallows the step. */
function brokenNoOp() {}

/** BUG: steps by two. */
function brokenStepsTwice(m) {
  m.mem8[SEQUENCE_SUBSTEP] = m.mem8[SEQUENCE_SUBSTEP] + 2;
}

/** BUG: steps the cell below the target, leaving the target untouched. */
function brokenWrongCell(m) {
  const addr = (SEQUENCE_SUBSTEP - 1) & 0xffff;
  m.mem8[addr] = m.mem8[addr] + 1;
}

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["steps-by-two", brokenStepsTwice],
  ["wrong-cell", brokenWrongCell],
]) {
  test(`TEETH: the ${label} twin is CAUGHT at the real dispatch`, { skip: SKIP }, () => {
    const r = gate(twin);
    assert.notEqual(r.ram, null, `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${show(r.ram)}`);
  });

  test(`TEETH: the ${label} twin is CAUGHT on every prior`, { skip: SKIP }, () => {
    let caught = 0;
    for (let prior = 0; prior < 256; prior++) if (sweepDiff(twin, prior)) caught++;
    assert.equal(caught, 256, `the sweep missed the ${label} twin on ${256 - caught} prior(s)`);
    console.log(`  TEETH/${label}: caught on all ${caught} priors`);
  });
}
