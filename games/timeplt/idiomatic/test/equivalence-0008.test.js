// SPDX-License-Identifier: GPL-3.0-only
/**
 * fetchTableByte — memory-equivalent to the frozen oracle at ROM 0x0008.
 *
 * GATE: strict unit-capture through unitEquivalence, PLUS an explicit live-out comparison,
 *   exhaustive over the index and over every table base the driven coin -> start tape reaches.
 *
 * WHY THE SECOND HALF EXISTS, AND WHY THE FIRST HALF ALONE WOULD BE A FRAUD. This routine
 *   writes no memory at all. Its whole effect is the fetched byte and the advanced pointer,
 *   both of which live in the Z80 register file that memory-equivalence deliberately drops.
 *   So `r.ram` is null for EVERY candidate here, a no-op included — which the BLIND test below
 *   asserts outright rather than leaving as an unstated hole. The teeth are therefore in the
 *   live-out comparison: RAM must still match, and so must the three registers a caller reads.
 *   {f, sp} are the excluded set and the sweep pins that shape, so "excluded" cannot widen.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical, via unitEquivalence unchanged.
 *   2. BLIND — the same call passes a no-op, which is the justification for tests 3 onward.
 *   3. EXHAUSTIVE — the index is one byte, so all 256 values are swept at every distinct
 *      table base the tape reaches. The bases are real captures, not synthesised, so this is
 *      the input distribution the game produces; the run prints them.
 *   4. TEETH — three broken twins, each caught by the SAME comparison the real arm passes,
 *      and each caught on EXACTLY the inputs on which it can differ, not merely somewhere.
 *
 * HOLE: the base pointer is only ever what the tape produced. A base high enough that the sum
 * straddles the top of the address space is not in the corpus, so the 16-bit wrap is asserted
 * by construction and not by observation. The carry out of the low byte IS observed, and the
 * sweep refuses to pass unless some trial crossed it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0008.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { loc_0008 as oracle } from "../../translated/loc_0008.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x0008;

// ENTRY_FRAMES is enough to reach the routine (unitEquivalence throws if it were not), but the
// tape is still early in its first life then and only a handful of tables have been consulted.
// Running it on multiplies the distinct bases, and brings in one that lives in work RAM.
const CORPUS_FRAMES = 1200;

/** The registers a caller reads back: the fetched byte, and the two halves of the pointer. */
const LIVE_OUT = ["a", "h", "l"];

/** The registers memory-equivalence drops: the flag byte, and the stack the frozen ret pops. */
const EXCLUDED = ["f", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored and absent";
const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");

// ── the corpus ──────────────────────────────────────────────────────────────────────────────
// One host run, one pristine clone per distinct table base. Everything below works off those
// clones, so the whole gate costs a single emulation.

let corpus = null;
function entries() {
  if (corpus === null) {
    const seen = new Map();
    const capture = new Map([[TARGET, (m) => {
      if (!seen.has(m.regs.hl)) seen.set(m.regs.hl, m.clone());
      return oracle(m);
    }]]);
    makeMachine(capture).runFrames(CORPUS_FRAMES);
    corpus = [...seen.values()];
  }
  return corpus;
}

/**
 * Run oracle and candidate from every captured base, at every index, and tally. `caught` is
 * the count the teeth are measured in: a trial is caught when RAM moved or a live-out did.
 */
function sweep(candidate) {
  const moved = new Set();
  let trials = 0, caught = 0, carrying = 0, caughtCarrying = 0, stepped = 0, caughtStepped = 0;
  let returnMismatch = 0;
  for (const captured of entries()) {
    const a = captured.clone();
    const b = captured.clone();
    const start = {};
    for (const k of REG_FIELDS) start[k] = captured.regs[k];
    for (let index = 0; index < 256; index++) {
      for (const k of REG_FIELDS) {
        a.regs[k] = start[k];
        b.regs[k] = start[k];
      }
      a.regs.a = index;
      b.regs.a = index;
      oracle(a);
      const returned = candidate(b);
      const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
      const differing = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
      for (const k of differing) moved.add(k);
      const bad = ram !== null || differing.some((k) => LIVE_OUT.includes(k));
      if (!bad && returned !== b.regs.a) returnMismatch++;
      trials++;
      if (bad) caught++;
      if (start.l + index > 255) {
        carrying++;
        if (bad) caughtCarrying++;
      }
      if (index !== 0) {
        stepped++;
        if (bad) caughtStepped++;
      }
    }
  }
  return { trials, caught, carrying, caughtCarrying, stepped, caughtStepped, returnMismatch, moved };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: fetchTableByte == oracle on RAM", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, fetchTableByte, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.equal(r.ram, null, `RAM diverged — ${JSON.stringify(r.ram)}`);
  console.log(`  EQUAL: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("BLIND: the RAM diff alone passes a no-op, so it is not the gate", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, () => {}, { maxFrames: ENTRY_FRAMES });
  assert.equal(
    r.ram,
    null,
    "a no-op made RAM move — then this routine writes memory after all, and the whole " +
      "premise of the live-out comparison below needs re-deriving",
  );
  console.log("  BLIND: confirmed — RAM cannot fail here; the teeth are the live-out sweep");
});

test("EXHAUSTIVE: every index at every captured base matches the oracle", { skip }, () => {
  const bases = entries().length;
  assert.ok(bases > 0, "vacuous: the tape never reached the routine");
  const r = sweep(fetchTableByte);
  assert.equal(r.caught, 0, `${r.caught} of ${r.trials} trials diverged on RAM or a live-out`);
  assert.equal(r.returnMismatch, 0, "the returned byte must be the byte left for the caller");
  assert.ok(r.carrying > 0, "no trial crossed the low-byte carry — the sweep proves nothing");
  console.log(
    `  EXHAUSTIVE: ${r.trials} trials over ${bases} bases (${entries().map((e) => hex4(e.regs.hl)).join(" ")}) ` +
      `identical, ${r.carrying} of them across the carry`,
  );
});

test("EXCLUDED, deliberately: only the flag byte and the stack pointer may move", { skip }, () => {
  const r = sweep(fetchTableByte);
  const widened = [...r.moved].filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(widened, [], `the excluded set widened to include ${widened.join(", ")}`);
  console.log(`  EXCLUDED: ${[...r.moved].join(", ")} — and nothing else, over ${r.trials} trials`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Each twin is a plausible way to get an indexed fetch wrong, and each is asserted caught on
// EXACTLY the inputs on which it can differ. "Caught somewhere" would pass a twin that is right
// almost everywhere, which is the shape a real defect takes.

/** BUG: adds the index to the low half of the pointer and drops the carry into the high half. */
function brokenNoCarry(m) {
  const { regs, mem8 } = m;
  const entry = (regs.hl & 0xff00) | ((regs.l + regs.a) & 0xff);
  regs.hl = entry;
  regs.a = mem8[entry];
  return regs.a;
}

/** BUG: fetches the right byte but leaves the pointer at the base instead of at the entry. */
function brokenPointerStaysAtBase(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[u16(regs.hl + regs.a)];
  return regs.a;
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

test("TEETH: the no-carry twin is caught on every trial that carries", { skip }, () => {
  const r = sweep(brokenNoCarry);
  assert.ok(r.carrying > 0, "no trial carried, so this twin could not have been tested");
  assert.equal(r.caughtCarrying, r.carrying, "the sweep let a dropped carry through");
  assert.equal(r.caught, r.carrying, "and it must be caught on the carrying trials ONLY");
  console.log(`  TEETH/no-carry: caught ${r.caught} of ${r.trials}, exactly the carrying trials`);
});

test("TEETH: the stuck-pointer twin is caught on every non-zero index", { skip }, () => {
  const r = sweep(brokenPointerStaysAtBase);
  assert.ok(r.stepped > 0, "every index was zero, so this twin could not have been tested");
  assert.equal(r.caughtStepped, r.stepped, "the sweep let an unmoved pointer through");
  assert.equal(r.caught, r.stepped, "and a zero index genuinely leaves the pointer where it was");
  console.log(`  TEETH/stuck-pointer: caught ${r.caught} of ${r.trials}, exactly the stepped ones`);
});

test("TEETH: the no-op twin is caught, which unitEquivalence alone was not", { skip }, () => {
  const r = sweep(brokenNoOp);
  assert.ok(r.stepped > 0, "vacuous: nothing to catch");
  assert.equal(r.caughtStepped, r.stepped, "a routine that does nothing must fail everywhere");
  console.log(`  TEETH/no-op: caught ${r.caught} of ${r.trials} — the RAM-only arm caught none`);
});
