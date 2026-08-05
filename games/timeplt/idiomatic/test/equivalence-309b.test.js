// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_309b — memory-equivalent to the frozen oracle at ROM 0x309B.
 *
 * GATE: strict unit-capture over the routine's WHOLE captured input space, plus a whole-machine
 *   replay of driven play. RAM ALONE CANNOT GATE THIS ROUTINE. It writes no memory, so
 *   unitEquivalence reports `ram: null` for the correct arm, for every broken twin, and for a
 *   bare no-op. The BLIND test below asserts exactly that, and it is the written justification
 *   for gating everywhere else on RAM *plus* the declared live-out {ix, iy}.
 *
 * What it exercises, holes stated:
 *   1. CONTRACT — unitEquivalence at the first real dispatch: RAM identical. `equal` is not
 *      asserted; it folds in the register diff this contract deliberately drops.
 *   2. BLIND — the same call passes a no-op. If it ever fails, the routine writes memory after
 *      all and this whole file has to be re-derived from the oracle.
 *   3. CORPUS — every distinct cursor pair the driven tape produces, each replayed from its own
 *      captured machine. The pairs are enumerable: eight, stable at 1200, 2000 and 3000 frames.
 *   4. EXCLUDED — {f, d, e, sp} and pc diverge by design, nothing else does. The oracle loads
 *      its addend into de, adds it (touching the flags) and pops its return; a rewrite that
 *      returns to JS does none of the three. What licenses dropping them is the CALLERS: all
 *      nine reach here by tail transfer, and every continuation reloads d and e from memory
 *      before reading them and branches on no flag. Test 7 is the falsifiable version.
 *   5. EXHAUSTIVE — each cursor swept over all 65536 values with the other held at its captured
 *      value, so the 16-bit wrap is covered rather than assumed.
 *   6. TEETH — three broken twins, each caught by the corpus arm and by the sweep.
 *   7. WHOLE-MACHINE — 800 frames of driven play with the candidate wired, RAM diffed every
 *      frame against the all-oracle baseline, and the twins caught there too. This is the arm
 *      that makes the live-out declaration falsifiable: a dropped register that some caller
 *      really consumed would fork the game here.
 *
 * The replay needs a shim, `hosted()`. This host engine is cycle-driven, and every caller
 * arrives by tail transfer, so a candidate that charges no T-states and does not take the Z80
 * return both moves the vblank interrupt and leaks two stack bytes per dispatch — measured, the
 * game dies of it. The shim pays both, identically for the real arm and for every twin, which
 * is what keeps the comparison honest. It belongs to the harness, not to the routine.
 *
 * HOLE: one tape. Everything rides the shared coin -> start tape, so a cursor pair produced by
 * some state that tape never reaches would not be in the corpus. The exhaustive sweep is what
 * covers the rest of the input space; the corpus is what proves the real one is covered.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-309b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_309b } from "../loc_309b.js";
import { loc_309b as oracle } from "../../translated/loc_309b.js";
import { firstStateDiff, unitEquivalence, wholeMachineEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x309b;

/** Frames for the corpus capture. Longer than ENTRY_FRAMES: play starts around 620. */
const CORPUS_FRAMES = 1200;
const MIN_CORPUS = 8;

/** Frames for the whole-machine replay. Enough play for the twins to fork the game. */
const WHOLE_FRAMES = 800;

/** T-states the oracle charges before its return, and for the return itself. */
const DISPATCH_TSTATES = 45;
const RET_TSTATES = 10;

const LIVE_OUT = ["ix", "iy"];
const EXCLUDED = ["f", "d", "e", "sp"];

const skip = romsPresent() ? false : "ROM images absent";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const pairOf = (mm) => `${hex4(mm.regs.ix)}/${hex4(mm.regs.iy)}`;

/** Adapt a candidate to the cycle-driven host: pay the dispatch, then take the Z80 return. */
function hosted(candidate) {
  return (mm) => {
    candidate(mm);
    mm.tick(DISPATCH_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

/** One pristine machine per distinct cursor pair seen in a driven run, plus the dispatch count. */
function captureCorpus() {
  if (corpus) return corpus;
  const byPair = new Map();
  let dispatches = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    const key = pairOf(mm);
    if (!byPair.has(key)) byPair.set(key, mm.clone());
    return oracle(mm);
  }]]));
  m.runFrames(CORPUS_FRAMES);
  corpus = { entries: [...byPair.values()], pairs: [...byPair.keys()], dispatches };
  return corpus;
}

/**
 * The comparison with teeth: oracle vs candidate on independent clones of one captured entry,
 * diffed on RAM first and then on the declared live-out. Returns null when they agree.
 */
function unitDiff(candidate, entry) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `ram ${hex4(ram.addr ?? 0)}: oracle=${ram.a} candidate=${ram.b}`;
  for (const k of LIVE_OUT) {
    if (a.regs[k] !== b.regs[k]) return `${k}: oracle=${hex4(a.regs[k])} candidate=${hex4(b.regs[k])}`;
  }
  return null;
}

/**
 * Sweep one cursor over all 65536 values on a captured entry, the other held. The oracle's
 * return pops, so its stack pointer is restored each round rather than walked into the weeds.
 */
function sweepCursor(candidate, which) {
  const entry = captureCorpus().entries[0];
  const a = entry.clone();
  const b = entry.clone();
  const sp = a.regs.sp;
  const heldIx = a.regs.ix;
  const heldIy = a.regs.iy;
  let caught = 0;
  for (let v = 0; v < 65536; v++) {
    a.regs.sp = sp;
    a.regs.ix = which === "ix" ? v : heldIx;
    a.regs.iy = which === "iy" ? v : heldIy;
    b.regs.ix = a.regs.ix;
    b.regs.iy = a.regs.iy;
    oracle(a);
    candidate(b);
    if (a.regs.ix !== b.regs.ix || a.regs.iy !== b.regs.iy) caught++;
  }
  return caught;
}

/** The whole-machine replay, with the candidate wired through the host shim. */
function replay(candidate) {
  return wholeMachineEquivalence(makeMachine, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: loc_309b == oracle on RAM at the real dispatch", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, loc_309b, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.equal(r.ram, null, `RAM diverged — ${JSON.stringify(r.ram)}`);
  console.log(`  CONTRACT: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("BLIND: RAM alone passes a no-op, so RAM alone is not the gate", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, () => {}, { maxFrames: ENTRY_FRAMES });
  assert.equal(
    r.ram,
    null,
    "the no-op DIVERGED on RAM — this routine writes memory after all, and every gate in " +
      "this file that leans on the live-out instead of RAM must be re-derived",
  );
  console.log("  BLIND: a no-op candidate is RAM-identical — the live-out is the only gate");
});

test("CORPUS: every captured cursor pair replays identically", { skip }, () => {
  const { entries, pairs, dispatches } = captureCorpus();
  assert.ok(dispatches > 0, "vacuous: the tape never reached the routine");
  assert.ok(
    entries.length >= MIN_CORPUS,
    `the corpus thinned to ${entries.length} pairs — a thin corpus is a weak gate`,
  );
  for (const entry of entries) {
    const d = unitDiff(loc_309b, entry);
    assert.equal(d, null, `${pairOf(entry)}: ${d}`);
  }
  console.log(`  CORPUS: ${dispatches} dispatches, ${entries.length} distinct — ${pairs.join(" ")}`);
});

test("EXCLUDED, deliberately: only the dropped registers and pc diverge", { skip }, () => {
  const entry = captureCorpus().entries[0];
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  loc_309b(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    EXCLUDED,
    "the excluded set changed shape: only the flag byte, the addend pair and the stack " +
      "pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  for (const k of LIVE_OUT) assert.equal(a.regs[k], b.regs[k], `the live-out ${k} must match`);
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc — the cursors match`);
});

test("EXHAUSTIVE: both cursors step as the oracle steps them, over all 65536 values", { skip }, () => {
  for (const which of LIVE_OUT) {
    const caught = sweepCursor(loc_309b, which);
    assert.equal(caught, 0, `${which} sweep: ${caught} of 65536 values diverged`);
  }
  const entry = captureCorpus().entries[0].clone();
  entry.regs.ix = 0xfff8;
  entry.regs.iy = 0xffff;
  loc_309b(entry);
  assert.equal(entry.regs.ix, 0x0008, "the record cursor must wrap at 16 bits, not widen");
  assert.equal(entry.regs.iy, 0x0001, "the entry cursor must wrap at 16 bits, not widen");
  console.log("  EXHAUSTIVE: 65536 values per cursor identical, including the 16-bit wrap");
});

test("WHOLE-MACHINE: 800 driven frames are byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(loc_309b);
  const fired = w.invocations.get(TARGET);
  assert.ok(fired > 0, "vacuous: the override never dispatched in this many frames");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${fired} dispatches, RAM identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin is a plausible way to get a two-cursor step wrong, and each must be caught by the
// SAME three comparisons the real arm passes. The no-op is the one that matters most here: it
// is what a gate reading only RAM would wave through.

/** BUG: advances neither cursor, so every caller re-works slot zero. */
function brokenNoOp() {}

/** BUG: steps the record cursor half a record, landing mid-record from the second slot on. */
function brokenRecordStride(m) {
  m.regs.ix = m.regs.ix + 8;
  m.regs.iy = m.regs.iy + 2;
}

/** BUG: steps the entry cursor one byte, as if the doubled increment were a single one. */
function brokenEntryStride(m) {
  m.regs.ix = m.regs.ix + 16;
  m.regs.iy = m.regs.iy + 1;
}

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["record-stride", brokenRecordStride],
  ["entry-stride", brokenEntryStride],
]) {
  test(`TEETH: the ${label} twin is CAUGHT on every captured pair`, { skip }, () => {
    const { entries } = captureCorpus();
    const missed = entries.filter((e) => unitDiff(twin, e) === null);
    assert.equal(missed.length, 0, `the ${label} twin slipped ${missed.map(pairOf).join(" ")}`);
    console.log(`  TEETH/${label}: caught on all ${entries.length} pairs — ${unitDiff(twin, entries[0])}`);
  });

  test(`TEETH: the ${label} twin is CAUGHT across the sweep`, { skip }, () => {
    for (const which of LIVE_OUT) {
      const caught = sweepCursor(twin, which);
      assert.equal(caught, 65536, `the ${which} sweep missed the ${label} twin somewhere`);
    }
    console.log(`  TEETH/${label}: caught on all 65536 values of each cursor`);
  });

  test(`TEETH: the ${label} twin FORKS the whole machine`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.equal, false, `the ${label} twin ran 800 frames clean — the replay has no teeth`);
    console.log(`  TEETH/${label}: forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  });
}
