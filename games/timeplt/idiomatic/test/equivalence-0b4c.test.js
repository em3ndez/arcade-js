// SPDX-License-Identifier: GPL-3.0-only
/**
 * sumByteRunAndCompareToExpected — memory-equivalent to the frozen oracle at ROM 0x0B4C.
 *
 * GATE: strict unit-capture, plus crafted sweeps over each argument in turn, plus teeth. What it exercises, holes stated:
 *
 *   1. ★ RAM IS NOT THE GATE HERE, AND SAYING SO IS THE POINT. This routine writes NOTHING, so
 *      a RAM comparison passes a candidate that does nothing at all. The contract is therefore
 *      the returned answer, held against the zero flag the oracle's comparison leaves, and every
 *      arm below asserts it. The "not vacuous" test proves the RAM-only reading is empty by
 *      showing a no-op candidate survives it.
 *   2. EQUAL at the real dispatch — the captured entry replayed on two clones.
 *   3. EXCLUDED, deliberately, and read off the oracle's one caller: the oracle leaves the total
 *      in A, the pointer in HL, a spent count in B and the comparison's flags in F, and the only
 *      call site (0x30AC) reloads every one of them before reading any -- ld a,(0xad04), add a,a,
 *      ld hl,0x3176, ld b,0x08 -- so none is a live-out and the rewrite no longer leaves them. What
 *      is asserted instead is stronger than a ceiling: the rewrite leaves EVERY register as it found
 *      it. The total is not lost: the answer is swept over all 256 expected bytes at every length
 *      and base, so a wrong total disagrees with the oracle's zero flag at two of them.
 *   4. CORPUS — every dispatch of a driven session and of the undriven attract demo. ★ THIS IS A
 *      THIN CORPUS AND THAT IS THE HEADLINE: the routine fires a handful of times in thousands
 *      of frames, always on the same arguments. The crafted sweep is the load-bearing arm.
 *   5. EXHAUSTIVE over every expected value 0..255 against a total held fixed by the real
 *      pointer, and a length sweep that reaches the zero-length case the real corpus never
 *      presents — the one where a count of zero means a full 256 bytes rather than none.
 *   6. THE BASE POINTER IS SWEPT SEPARATELY, and it has to be: the two sweeps above hold it at
 *      the one value the single call site supplies, so a candidate that ignored its argument and
 *      always read that address would pass both of them. Its own arm below varies the base and
 *      its own twin proves the arm bites.
 *   7. TEETH — broken twins, each with the exact number of crafted entries that catch it.
 *   8. HARMLESS — the pointer-not-moved twin, whose only defect is a register the caller reloads,
 *      is caught on no crafted entry.
 *   9. DEAD AT EXIT — the set in 3 measured on the ORACLE rather than read off the call site: every
 *      register in it complemented where the frozen routine hands back, over both sessions, is heard
 *      nowhere, with an SP flip at the same exit as the control that the exit poison lands.
 *
 * HOLE: the single call site in the image discards the answer, the total, the pointer and the
 * flags alike, so nothing downstream can distinguish this rewrite from one that returns a
 * constant. This file gates the routine, not its usefulness.
 * HOLE: no run reaches this entry with a length of zero or with a pointer other than the one its
 * caller fixes, so both are covered by crafted entries only.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0b4c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { sumByteRunAndCompareToExpected } from "../sumByteRunAndCompareToExpected.js";
import { loc_0b4c as oracle } from "../../translated/loc_0b4c.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { assertDeadAtExit } from "./_deadAtExit.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x0b4c;
const EXCLUDED = ["sp"];
/** What the oracle leaves in registers -- total in A, compare flags in F, spent count in B, pointer
 * in HL -- and the one call site in the image (0x30AC) reloads each before any read. */
const ORACLE_DEAD = ["a", "f", "b", "h", "l"];
const CORPUS_FRAMES = 2500;

const TAPES = [
  ["driven", {}],
  ["attract", { tape: [] }],
];

/** Dispatches each session produces. Measured; a move here is a finding, not a nuisance. */
const DISPATCHES = { driven: 3, attract: 1 };

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

let entry = null;

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
  if (entry === null) gate(sumByteRunAndCompareToExpected);
  return entry;
}

/**
 * The real contract: RAM, then the returned answer against the zero flag the oracle's comparison
 * leaves. The registers the oracle leaves are dead at its one caller (EXCLUDED, below).
 */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const answerA = oracle(a);
  const answerB = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  // The oracle returns nothing, so the answer is checked against the flag it leaves instead.
  const oracleSaysEqual = (a.regs.f & 0x40) !== 0;
  if (oracleSaysEqual !== Boolean(answerB)) {
    return { addr: null, reg: "answer", a: oracleSaysEqual, b: answerB };
  }
  if (answerA !== undefined) return { addr: null, reg: "oracle-return", a: answerA, b: answerB };
  return null;
}

/** A real captured machine with the three arguments forced: the crafted-entry idiom. */
function craft(base, length, expected) {
  const m = entryState().clone();
  m.regs.hl = base;
  m.regs.b = length;
  m.regs.c = expected;
  return m;
}

const REAL_BASE = 0x086b;
const REAL_LENGTH = 0x10;

/** Every expected byte, at the real length and at every length of a sweep that reaches the zero
 * case: the answer is yes at exactly one expected byte per run, so this pins each run's total. */
const EXPECTED_SWEEP = Array.from({ length: 256 }, (_unused, v) => v);
const LENGTH_SWEEP = [0, 1, 2, 3, 15, 16, 17, 64, 128, 254, 255];

function sweepCaught(candidate) {
  let caught = 0;
  for (const length of LENGTH_SWEEP) {
    for (const expected of EXPECTED_SWEEP) {
      if (unitDiff(candidate, craft(REAL_BASE, length, expected))) caught++;
    }
  }
  return caught;
}

const SWEEP_SIZE = EXPECTED_SWEEP.length * LENGTH_SWEEP.length;

/**
 * Bases other than the one the single call site fixes. The two sweeps above cannot see a
 * candidate that ignores its pointer argument, because they never move it.
 */
const BASE_SWEEP = [0x0800, 0x0900, 0x0a00, 0x1000, 0x2000];

function baseSweepCaught(candidate) {
  let caught = 0;
  for (const base of BASE_SWEEP) {
    for (const expected of EXPECTED_SWEEP) {
      if (unitDiff(candidate, craft(base, REAL_LENGTH, expected))) caught++;
    }
  }
  return caught;
}

/** BUG: reads the address its one caller happens to pass, ignoring the argument. */
function brokenIgnoresBase(m) {
  m.regs.hl = REAL_BASE;
  return sumByteRunAndCompareToExpected(m);
}

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const args = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      args.add(`${hex4(mm.regs.hl)}/${mm.regs.b}/${mm.regs.c}`);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, args };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, sumByteRunAndCompareToExpected) }));
  }
  return sessionCache;
}

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: sums one byte too few, so the run stops short of the length it was given. */
function brokenShortByOne(m) {
  const { regs, mem8 } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  let total = 0;
  for (let i = 0; i < run - 1; i++) total = (total + mem8[(regs.hl + i) & 0xffff]) & 0xff;
  regs.a = total;
  regs.hl = (regs.hl + run) & 0xffff;
  regs.b = 0;
  regs.cp(regs.c);
  return total === regs.c;
}

/** BUG: reads a length of zero as no bytes at all rather than as a full 256. */
function brokenZeroMeansNone(m) {
  const { regs, mem8 } = m;
  const run = regs.b;
  let total = 0;
  for (let i = 0; i < run; i++) total = (total + mem8[(regs.hl + i) & 0xffff]) & 0xff;
  regs.a = total;
  regs.hl = (regs.hl + run) & 0xffff;
  regs.b = 0;
  regs.cp(regs.c);
  return total === regs.c;
}

/** BUG: lets the total grow past a byte instead of wrapping. */
function brokenNoWrap(m) {
  const { regs, mem8 } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  let total = 0;
  for (let i = 0; i < run; i++) total += mem8[(regs.hl + i) & 0xffff];
  regs.a = total & 0xff;
  regs.hl = (regs.hl + run) & 0xffff;
  regs.b = 0;
  regs.cp(regs.c);
  return total === regs.c;
}

/** BUG: answers yes whatever the total is, which is what an unchecked fold looks like. */
function brokenAlwaysAgrees(m) {
  const { regs, mem8 } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  let total = 0;
  for (let i = 0; i < run; i++) total = (total + mem8[(regs.hl + i) & 0xffff]) & 0xff;
  regs.a = total;
  regs.hl = (regs.hl + run) & 0xffff;
  regs.b = 0;
  regs.cp(total);
  return true;
}

/** BUG: compares the total against the length instead of the expected byte. */
function brokenComparesLength(m) {
  const { regs, mem8 } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  let total = 0;
  for (let i = 0; i < run; i++) total = (total + mem8[(regs.hl + i) & 0xffff]) & 0xff;
  return total === regs.b;
}

/** Formerly a BUG, now HARMLESS: the right answer, but the pointer left where it started instead of one
 * past the run. HL is dead at the one caller (DEAD AT EXIT), so this is not a defect. */
function brokenPointerNotMoved(m) {
  const { regs, mem8 } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  let total = 0;
  for (let i = 0; i < run; i++) total = (total + mem8[(regs.hl + i) & 0xffff]) & 0xff;
  regs.a = total;
  regs.b = 0;
  regs.cp(regs.c);
  return total === regs.c;
}

// Measured counts over the length-by-expected sweep. A candidate that answers from a wrong total
// disagrees with the oracle at most at two expected bytes per run (the true total and its own), so
// the counts are small by construction; the no-op answers no everywhere and is caught exactly once
// per swept length, where the oracle's total matches.
const TWINS = [
  ["no-op", brokenNoOp, 11],
  ["short-by-one", brokenShortByOne, 20],
  // The weakest twin here, and deliberately kept: only the crafted zero-length run sees it.
  ["zero-means-none", brokenZeroMeansNone, 2],
  // Caught at the one expected byte per run where the MASKED total matches and the unmasked one,
  // far past a byte on all but the shortest runs, cannot.
  ["no-wrap", brokenNoWrap, 10],
  ["always-agrees", brokenAlwaysAgrees, 2805],
  ["compares-the-length", brokenComparesLength, 11],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: sumByteRunAndCompareToExpected == oracle on RAM and the answer", { skip }, () => {
  const r = gate(sumByteRunAndCompareToExpected);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const d = unitDiff(sumByteRunAndCompareToExpected, entryState());
  assert.equal(d, null, `the contract diverged — ${JSON.stringify(d)}`);
  console.log(
    `  EQUAL: entry pointer=${hex4(entryState().regs.hl)} length=${entryState().regs.b} ` +
      `expected=${entryState().regs.c}; RAM and the answer identical`,
  );
});

test("NOT VACUOUS: RAM alone passes a candidate that does nothing", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenNoOp(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(
    ram,
    null,
    "a RAM difference appeared, so this routine DOES write memory after all and the whole " +
      "register-contract framing of this file must be re-derived",
  );
  assert.notEqual(unitDiff(brokenNoOp, entryState()), null, "the real contract must catch it");
  console.log("  NOT VACUOUS: RAM is empty here; the answer is the gate");
});

test("EXCLUDED, deliberately: what the oracle leaves in registers, none of it read by its one caller", { skip }, () => {
  const e = entryState();
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  sumByteRunAndCompareToExpected(b);
  // The rewrite is pure on the register file: every register as it arrived.
  assert.deepEqual(REG_FIELDS.filter((k) => b.regs[k] !== e.regs[k]), [],
    "the rewrite moved a register, and nothing downstream reads one");
  // The oracle's own register product is exactly the dead set its caller reloads, plus the return.
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== e.regs[k]).filter((k) => !EXCLUDED.includes(k)),
    ORACLE_DEAD.filter((k) => a.regs[k] !== e.regs[k]),
    "the oracle moved a register outside the set its one caller reloads, so that set is wrong",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  // Control: a rewrite that leaves a register behind is seen by the purity check above.
  const c = e.clone();
  sumByteRunAndCompareToExpected(c);
  c.regs.a = (c.regs.a + 1) & 0xff;
  assert.notDeepEqual(REG_FIELDS.filter((k) => c.regs[k] !== e.regs[k]), [], "the purity check is blind");
  console.log(`  EXCLUDED: oracle leaves ${ORACLE_DEAD.join(", ")} (dead at 0x30AC) and ${EXCLUDED.join(", ")}; rewrite moves none`);
});

test("CORPUS: every real dispatch replays identically, on a thin and uniform corpus", { skip }, () => {
  const seen = sessions();
  let total = 0;
  for (const s of seen) {
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.deepEqual(
      [...s.args],
      [`${hex4(REAL_BASE)}/${REAL_LENGTH}/34`],
      `the ${s.label} tape now presents more than one argument set, so the crafted sweep is ` +
        "anchored to the wrong entry",
    );
    total += s.dispatches;
  }
  console.log(`  CORPUS: ${total} dispatches over two sessions, one argument set, identical`);
});

test("EXHAUSTIVE: every expected byte, and a length sweep reaching the zero case", { skip }, () => {
  assert.equal(sweepCaught(sumByteRunAndCompareToExpected), 0, "the rewrite diverged somewhere in the crafted space");

  // The zero-length case is the one the corpus can never show: a count of zero is a full run.
  const zero = craft(REAL_BASE, 0, 0);
  oracle(zero);
  assert.equal(zero.regs.hl, (REAL_BASE + 256) & 0xffff, "zero must walk a full 256 bytes");
  const full = craft(REAL_BASE, 0, zero.regs.a);
  assert.equal(sumByteRunAndCompareToExpected(full), true, "the rewrite does not fold the same full run");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} crafted entries identical, the zero-length run included`);
});

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's crafted catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught by nothing`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} crafted entries`);
  });
}

test("HARMLESS: the pointer-not-moved twin is caught on no crafted entry", { skip }, () => {
  assert.equal(sweepCaught(brokenPointerNotMoved), 0, "the pointer is not a live-out; only the answer may be judged");
  assert.equal(baseSweepCaught(brokenPointerNotMoved), 0, "the pointer is not a live-out at any base either");
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenPointerNotMoved(b);
  assert.notEqual(b.regs.hl, a.regs.hl, "the twin must actually leave HL different, or this proves nothing");
  console.log(`  HARMLESS/pointer-not-moved: caught on 0 of ${SWEEP_SIZE} crafted entries; HL ${hex4(b.regs.hl)} vs ${hex4(a.regs.hl)}`);
});

test("DEAD AT EXIT: on the frozen game, every register the oracle leaves is dead where it hands back", { skip }, () => {
  assertDeadAtExit({
    at: TARGET, poison: ORACLE_DEAD, frames: CORPUS_FRAMES,
    sessions: TAPES.map(([label, opts]) => ({ label, tape: opts.tape, dispatches: DISPATCHES[label] })),
  });
});

test("THE BASE POINTER IS SWEPT: the answer follows the caller's pointer", { skip }, () => {
  assert.equal(baseSweepCaught(sumByteRunAndCompareToExpected), 0, "the rewrite diverged at some base other than the real one");
  // Anti-vacuity: the arm is only evidence if the bases actually produce different folds.
  const folds = new Set(BASE_SWEEP.map((b) => { const m = craft(b, REAL_LENGTH, 0x22); oracle(m); return m.regs.a; }));
  assert.ok(folds.size > 1, "every swept base folds to the same byte — this arm proves nothing");
  console.log(`  BASE SWEEP: ${BASE_SWEEP.length} bases identical, and they do not all fold alike`);
});

test("TEETH: a twin that ignores the caller's pointer is caught, and ONLY by the base sweep", { skip }, () => {
  assert.equal(sweepCaught(brokenIgnoresBase), 0,
    "the expected/length sweeps caught it — then this file's own stated hole is wrong");
  const caught = baseSweepCaught(brokenIgnoresBase);
  assert.ok(caught > 0, "nothing catches a candidate that ignores its pointer argument");
  console.log(`  TEETH/ignores-base: invisible to ${SWEEP_SIZE} crafted entries, caught on ${caught} entries over ${BASE_SWEEP.length} bases`);
});
