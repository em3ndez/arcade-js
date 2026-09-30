// SPDX-License-Identifier: GPL-3.0-only
/**
 * fetchTableByte — memory-equivalent to the frozen oracle at ROM 0x0008.
 *
 * GATE: strict unit-capture through unitEquivalence, PLUS an explicit live-out comparison,
 *   exhaustive over the index and over every table base the driven coin -> start tape reaches.
 *
 * WHY THE SECOND HALF EXISTS, AND WHY THE FIRST HALF ALONE WOULD BE A FRAUD. This routine
 *   writes no memory at all. Its whole effect is the fetched byte, which lives in the Z80
 *   register file that memory-equivalence deliberately drops. So `r.ram` is null for EVERY
 *   candidate here, a no-op included — which the BLIND test below asserts outright rather than
 *   leaving as an unstated hole. The teeth are therefore in the live-out comparison: RAM must
 *   still match, and so must the fetched byte, in A and as the return value.
 *   The oracle ALSO leaves the advanced pointer in HL, and some frozen callers read it on (they
 *   walk on from the entry). THE POINTER HAND-OFF below measures which ones, on the oracle, over
 *   attract, coin-start and every distant state a tapes/*.poke.json schedule drives, and requires
 *   each one's frozen code to be replaced by an idiomatic override (an entry in names.js ROUTINES,
 *   the set resolveAllIdiomatic wires, which then runs instead of the frozen reader) — so no reader of that HL runs in the wired game, and the rewrite
 *   returns the byte only. That each override passes its own pointer is checked by review, not by
 *   this arm. {f, sp, h, l} are the excluded set and the sweep bounds it.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical, via unitEquivalence unchanged.
 *   2. BLIND — the same call passes a no-op, which is the justification for tests 3 onward.
 *   3. EXHAUSTIVE — the index is one byte, so all 256 values are swept at every distinct
 *      table base the tape reaches. The bases are real captures, not synthesised, so this is
 *      the input distribution the game produces; the run prints them.
 *   4. TEETH — broken twins, each caught by the SAME comparison the real arm passes, and each
 *      caught on EXACTLY the inputs on which it can differ, not merely somewhere. The twin that
 *      leaves the pointer at the base is now HARMLESS (the pointer is not a live-out) and is
 *      asserted caught nowhere.
 *   5. THE POINTER HAND-OFF — HL is complemented as the FROZEN routine hands back, one caller
 *      (return address) at a time, over the TAPE_SESSIONS of _deadAtExit.js (attract, coin-start,
 *      and each poke-driven distant state). The callers at which that is heard are pinned, and each
 *      one's owning routine must be an idiomatic override (names.js ROUTINES). HOLE: a reader
 *      reached only in a state none of those sessions drives is not measured.
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
import { ROUTINES } from "../names.js";
import { TAPE_SESSIONS, handOffReaders, heardAs } from "./_deadAtExit.js";

const TARGET = 0x0008;

// ENTRY_FRAMES is enough to reach the routine (unitEquivalence throws if it were not), but the
// tape is still early in its first life then and only a handful of tables have been consulted.
// Running it on multiplies the distinct bases, and brings in one that lives in work RAM.
const CORPUS_FRAMES = 1200;

/** The register a caller reads back: the fetched byte (also the return value). */
const LIVE_OUT = ["a"];

/** The registers allowed to differ: the flag byte, the stack the frozen ret pops, and the
 * advanced pointer, whose every oracle reader is overridden (THE POINTER HAND-OFF). */
const EXCLUDED = ["f", "sp", "h", "l"];

/**
 * Where the oracle's HL is heard, keyed by the return address of the rst, and the ROUTINES entries
 * whose overrides replace the frozen code that reads it. Measured by THE POINTER HAND-OFF below,
 * which prints the session each was first heard in. 0x5630 is the tail at 0x562a that the
 * sound-request entries 0x5628 / 0x5617 / 0x560c run into; 0x4681 lies in the frozen 0x43f0 body,
 * whose only way in is the `jr nz` at 0x43C0 inside 0x43b7 (a byte scan of the image for jumps,
 * calls and pointer loads to 0x43F0 finds no other).
 */
const HL_READERS = new Map([
  [0x3386, [0x335e]], [0x3725, [0x36af]], [0x37fc, [0x37d6]], [0x3893, [0x386e]],
  [0x3c4c, [0x3c25]], [0x3fbe, [0x3faf]], [0x4681, [0x43b7]], [0x4870, [0x4853]],
  [0x4c27, [0x4c1f]], [0x4ce0, [0x4cc3]], [0x4d12, [0x4cc3]], [0x5630, [0x5628, 0x5617, 0x560c]],
]);
const HANDOFF_FRAMES = 2500;

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

test("EXCLUDED, deliberately: only the flag byte, the stack pointer and the pointer may move", { skip }, () => {
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

/** Trials (every captured base x every index) on which `pred(mem8, base, index)` holds. */
function countWhere(pred) {
  let n = 0;
  for (const captured of entries()) {
    for (let index = 0; index < 256; index++) if (pred(captured.mem8, captured.regs.hl, index)) n++;
  }
  return n;
}

test("TEETH: the no-carry twin is caught on every carrying trial whose wrong byte differs", { skip }, () => {
  const r = sweep(brokenNoCarry);
  const expected = countWhere((mem8, base, index) =>
    (base & 0xff) + index > 255 && mem8[(base & 0xff00) | ((base + index) & 0xff)] !== mem8[u16(base + index)]);
  assert.ok(r.carrying > 0, "no trial carried, so this twin could not have been tested");
  assert.ok(expected > 0, "no carrying trial fetched a different byte, so this twin could not have been tested");
  assert.equal(r.caught, r.caughtCarrying, "a trial that does not carry cannot differ");
  assert.equal(r.caught, expected, "the sweep let a dropped carry through");
  console.log(`  TEETH/no-carry: caught ${r.caught} of ${r.trials}; ${r.carrying} carried, and exactly the ${expected} whose byte differs`);
});

test("HARMLESS: the stuck-pointer twin fetches the right byte, so it is caught nowhere", { skip }, () => {
  const r = sweep(brokenPointerStaysAtBase);
  assert.ok(r.stepped > 0, "every index was zero, so this twin could not have been tested");
  assert.equal(r.caught, 0, "the pointer is not a live-out; only the fetched byte may be judged");
  assert.ok(r.moved.has("l"), "the twin must actually leave the pointer elsewhere, or this proves nothing");
  console.log(`  HARMLESS/stuck-pointer: caught on 0 of ${r.trials}; its only defect is the pointer`);
});

test("THE POINTER HAND-OFF: every oracle reader of the advanced HL, over every tape session, is overridden", { skip }, () => {
  const { callers, readers, exitControl } = handOffReaders({ at: TARGET, poison: ["h", "l"], sessions: TAPE_SESSIONS, frames: HANDOFF_FRAMES });
  assert.ok(callers.size > 0, "vacuous: no rst 0x08 was taken");
  assert.deepEqual([...readers.keys()].sort((a, b) => a - b), [...HL_READERS.keys()],
    "the set of callers that read the oracle's HL moved -- a new reader needs its override checked");
  for (const [ret, owners] of HL_READERS) {
    const served = owners.filter((a) => ROUTINES[a] !== undefined);
    assert.deepEqual(served, owners, `the reader after ${hex4(ret)} is not served by an override`);
  }
  console.log(`  POINTER HAND-OFF: ${callers.size} callers over ${TAPE_SESSIONS.length} sessions, HL heard at ` +
    `${[...readers].map(([r, w]) => `${hex4(r)} (${w})`).join(" ")}, each served by an override; ` +
    `${callers.size - readers.size} callers never read it; exit control heard (${heardAs(exitControl)})`);
});

test("TEETH: the no-op twin is caught, which unitEquivalence alone was not", { skip }, () => {
  const r = sweep(brokenNoOp);
  // A no-op leaves the index in A, so it escapes exactly where the fetched byte equals the index.
  const expected = countWhere((mem8, base, index) => mem8[u16(base + index)] !== index);
  assert.ok(expected > 0, "vacuous: nothing to catch");
  assert.equal(r.caught, expected, "a routine that does nothing must fail wherever the byte is not the index");
  console.log(`  TEETH/no-op: caught ${r.caught} of ${r.trials} — the RAM-only arm caught none`);
});
