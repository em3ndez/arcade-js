// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_40ab — memory-equivalent to the frozen oracle at ROM 0x40AB.
 *
 * GATE: crafted-entry over a captured corpus. The routine's whole effect is three zero-stores
 *   through two bases the CALLER supplies, so RAM really is the contract here and the RAM diff
 *   is a live gate rather than a tautology — but only once the two holes below are shut.
 *
 * HOLE 1, THE DEAD FIRST DISPATCH — AND WHY A BIGGER BUDGET CANNOT SHUT IT. The prescribed
 *   capture takes the FIRST entry, not the first useful one, and this routine's first entry
 *   writes zero over three bytes that ALREADY read zero. That is invisible in RAM, so the
 *   prescribed gate passes a candidate that does nothing at all, and it does so at ANY frame
 *   budget: raising the shared budget adds later dispatches to the run but never changes which
 *   one is snapshotted. Only a different tape, or a capture that skips to the first LIVE entry,
 *   would move it. The FIRST-DISPATCH BLINDNESS test pins that relationship unconditionally
 *   instead of asserting a liveness this gate does not have.
 *
 * HOLE 2, THE PINNED BASES. One dispatch pins one base pair, so an implementation that ignores
 *   its bases and hard-codes those three addresses also passes. The PINNED twin below IS that
 *   implementation, and the test asserts both halves of the distinction: it SURVIVES the real
 *   dispatch it was pinned to, and DIES on every other base pair.
 *
 * TWO REPAIRS, both of which leave the harness alone, and both of which DO carry the guarantee
 * the prescribed gate cannot:
 *   1. A CORPUS of every dispatch the shared budget reaches. Most of them are LIVE — non-zero
 *      target bytes at entry — and the tests below assert positively that a no-op FAILS on each
 *      live one. That is the liveness guarantee, sited where it is true.
 *   2. CRAFTED ENTRIES — a real captured state with the two bases repointed at every base pair
 *      the transcribed setters use, and a band around each base painted with a non-zero,
 *      address-derived marker. Identical on both sides: a real state with a surgical nudge.
 *
 * REGISTERS AND PC ARE EXCLUDED, DELIBERATELY. Memory-equivalence drops the register trace, so
 * the frozen routine's return pops the stack pointer while the rewrite returns to JS; `equal` is
 * therefore false for a CORRECT routine and is never asserted on. The EXCLUDED test pins the
 * divergence to exactly {sp} plus pc so "excluded" cannot quietly widen.
 *
 * HOLES STATED. Coverage is the base pairs the transcribed setters load plus the pairs the real
 * dispatches carried — not every address a caller could conceivably pass. The painted band runs
 * four cells either side of the record base and from four before the entry base to four past the
 * second axis, so a wrong offset landing outside that band would not be caught. And nothing here
 * decides which of the two zeroed entry bytes is horizontal and which is vertical: the routine
 * does not care, and this gate does not claim it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-40ab.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_40ab } from "../loc_40ab.js";
import { loc_40ab as oracle } from "../../translated/loc_40ab.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x40ab;
const SECOND_AXIS = 49;

/** The corpus runs the SHARED budget, not a private one — a file-local window smaller than the
 * shared value silently narrows coverage the moment the shared value moves. */
const CORPUS_FRAMES = ENTRY_FRAMES;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";

/** Every base pair the transcribed setters load, so the sweep uses real pointers, not invented
 * ones. Pairs whose painted bands would overlap are skipped by `farApart`. */
const RECORD_BASES = [
  0xa800, 0xa810, 0xa820, 0xa830, 0xa840, 0xa850, 0xa860, 0xa870, 0xa880,
  0xa890, 0xa8a0, 0xa8b0, 0xa8c0, 0xa8e0, 0xa8f0, 0xa900, 0xaa10, 0xaa80, 0xac64,
];
const ENTRY_BASES = [
  0xaa10, 0xaa12, 0xaa14, 0xaa16, 0xaa18, 0xaa1a, 0xaa1c, 0xaa1e, 0xaa20,
  0xaa22, 0xaa24, 0xaa26, 0xaa28, 0xaa2c, 0xaa2e, 0xaa30, 0xaa80,
];
const farApart = (record, entry) => Math.abs(record - entry) > 64;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── capture ─────────────────────────────────────────────────────────────────────────────

let entry = null;

/** The prescribed gate, with the entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(loc_40ab);
  return entry;
}

let corpus = null;

/** Every real dispatch the tape produces, each a pristine clone taken on entry. */
function dispatches() {
  if (corpus !== null) return corpus;
  corpus = [];
  const host = makeMachine(new Map([[TARGET, (mm) => {
    corpus.push(mm.clone());
    return oracle(mm);
  }]]));
  host.runFrames(CORPUS_FRAMES);
  return corpus;
}

/** The three bytes this routine is supposed to clear, as they stand in `s`. */
function targets(s) {
  const { ix, iy } = s.regs;
  return [
    { addr: ix, was: s.mem8[ix] },
    { addr: iy, was: s.mem8[iy] },
    { addr: iy + SECOND_AXIS, was: s.mem8[iy + SECOND_AXIS] },
  ];
}

const isDegenerate = (s) => targets(s).every((t) => t.was === 0);

// ── crafted entries ─────────────────────────────────────────────────────────────────────

/** Odd, so never zero, and derived from the address, so a store to the wrong cell shows up as a
 * value no correct run could have left there. */
const mark = (addr) => ((addr * 7) & 0xfe) | 1;

function paint(s, from, to) {
  for (let a = from; a <= to; a++) s.mem8[a] = mark(a);
}

/** A real captured state, repointed at `record`/`entry` and painted around both bases. */
function craft(record, entryBase) {
  const s = entryState().clone();
  s.regs.ix = record;
  s.regs.iy = entryBase;
  paint(s, record - 4, record + 4);
  paint(s, entryBase - 4, entryBase + SECOND_AXIS + 4);
  return s;
}

/** Oracle vs candidate from one state, diffed on RAM alone. */
function replay(candidate, state, ...args) {
  const a = state.clone();
  const b = state.clone();
  oracle(a);
  candidate(b, ...args);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

function eachPair(fn) {
  let n = 0;
  for (const record of RECORD_BASES) {
    for (const entryBase of ENTRY_BASES) {
      if (!farApart(record, entryBase)) continue;
      fn(record, entryBase);
      n++;
    }
  }
  return n;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("ENTERED: the tape reaches the routine and loc_40ab == oracle on RAM", { skip: SKIP }, () => {
  const r = gate(loc_40ab);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const s = entryState();
  console.log(
    `  ENTERED: within ${ENTRY_FRAMES} frames at record ${hex4(s.regs.ix)}, ` +
      `entry ${hex4(s.regs.iy)}; targets ` +
      targets(s).map((t) => `${hex4(t.addr)}=${t.was}`).join(", "),
  );
});

test("FIRST-DISPATCH BLINDNESS: the prescribed gate snapshots the first entry, dead or alive", { skip: SKIP }, () => {
  const first = dispatches()[0];
  const captured = entryState();
  // The prescribed capture is the FIRST dispatch, not the first informative one — pinned here so
  // that "raise the budget" is never mistaken for a fix. A later dispatch is never snapshotted.
  assert.equal(captured.regs.ix, first.regs.ix, "the capture is not the run's first dispatch");
  assert.equal(captured.regs.iy, first.regs.iy, "the capture is not the run's first dispatch");
  assert.deepEqual(
    targets(captured).map((t) => t.was),
    targets(first).map((t) => t.was),
    "the capture and the corpus disagree about the first dispatch's target bytes",
  );

  const degenerate = isDegenerate(captured);
  const r = gate(() => {});
  assert.equal(
    r.ram === null,
    degenerate,
    "the no-op verdict must track the captured entry's degeneracy: a live entry MUST catch a " +
      "no-op, an all-zero one cannot. If this flips, the TAPE changed — not the frame budget.",
  );
  console.log(
    `  FIRST-DISPATCH BLINDNESS: first entry all-zero=${degenerate}, ` +
      `no-op survives the prescribed gate=${r.ram === null} (budget ${ENTRY_FRAMES} is not the lever)`,
  );
});

test("LIVE GUARANTEE: the corpus does reach dispatches a no-op cannot survive", { skip: SKIP }, () => {
  const live = dispatches().filter((s) => !isDegenerate(s));
  assert.ok(live.length > 0, "no live dispatch in the whole shared budget — the teeth are crafted-only");
  for (const s of live) {
    assert.ok(targets(s).some((t) => t.was !== 0), "a live dispatch must have a non-zero target");
    assert.notEqual(replay(() => {}, s), null, `a no-op survived the live dispatch at ${hex4(s.regs.ix)}`);
  }
  console.log(`  LIVE GUARANTEE: ${live.length} of ${dispatches().length} dispatches are live, each kills a no-op`);
});

test("EXCLUDED, deliberately: only the stack pointer and pc diverge", { skip: SKIP }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_40ab(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["sp"], "the excluded set changed shape: only the stack pointer may differ");
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("CORPUS: every real dispatch replays identically, and some are LIVE", { skip: SKIP }, () => {
  const all = dispatches();
  assert.ok(all.length > 0, "the tape produced no dispatch at all");
  let live = 0;
  for (const s of all) {
    const d = replay(loc_40ab, s);
    assert.equal(d, null, `dispatch at record ${hex4(s.regs.ix)}: ${show(d)}`);
    if (!isDegenerate(s)) live++;
  }
  assert.ok(live > 0, "every captured dispatch was all-zero — the corpus carries no teeth");
  console.log(
    `  CORPUS: ${all.length} dispatches in ${CORPUS_FRAMES} frames, ${live} live; ` +
      all.map((s) => `${hex4(s.regs.ix)}/${hex4(s.regs.iy)}`).join(" "),
  );
});

test("RAM IS THE GATE: on a live dispatch the diff lands on a target byte", { skip: SKIP }, () => {
  const live = dispatches().filter((s) => !isDegenerate(s));
  assert.ok(live.length > 0, "no live dispatch to prove the RAM diff with");
  for (const s of live) {
    const d = replay(() => {}, s);
    assert.notEqual(d, null, "a no-op must diverge from a routine that writes three bytes");
    const addrs = targets(s).map((t) => t.addr);
    assert.ok(addrs.includes(d.addr), `diff at ${hex4(d.addr)} is not one of the three targets`);
    assert.equal(d.a, 0, "the frozen routine leaves zero there");
    assert.notEqual(d.b, 0, "the no-op leaves the live value there");
  }
  console.log(`  RAM IS THE GATE: ${live.length} live dispatch(es), each catches a no-op on a target byte`);
});

test("CRAFTED: loc_40ab == oracle at every real base pair", { skip: SKIP }, () => {
  const n = eachPair((record, entryBase) => {
    const d = replay(loc_40ab, craft(record, entryBase));
    assert.equal(d, null, `record ${hex4(record)} entry ${hex4(entryBase)}: ${show(d)}`);
  });
  assert.ok(n > 100, "the pair sweep collapsed to almost nothing");
  console.log(`  CRAFTED: ${n} painted base pairs, RAM identical on every one`);
});

test("PARAMETERISED: explicit bases carry the meaning, not the machine's pointers", { skip: SKIP }, () => {
  const record = 0xa8c0;
  const entryBase = 0xaa28;
  const decoy = craft(record, entryBase);
  // The candidate's own pointers are aimed somewhere else entirely; only the arguments agree
  // with the frozen routine's registers, so a match proves the parameters are what is read.
  decoy.regs.ix = 0xa800;
  decoy.regs.iy = 0xaa10;
  const a = craft(record, entryBase);
  oracle(a);
  const b = decoy.clone();
  loc_40ab(b, record, entryBase);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, `explicit bases did not match the register-driven run — ${show(d)}`);
  console.log(`  PARAMETERISED: cleared ${hex4(record)}/${hex4(entryBase)} while pointing elsewhere`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin is a plausible way to get a two-pointer
// helper wrong, and each must be caught by the SAME comparison the real arm passes.

/** BUG: does nothing — the tell that a gate is measuring an unreached or dead routine. */
function brokenNoOp() {}

/** BUG: the offset field is off by one, so the entry's other coordinate survives and its
 * neighbour is destroyed instead. The easiest thing to get subtly wrong here. */
function brokenNeighbourOffset(m, record = m.regs.ix, entryBase = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[entryBase] = 0;
  mem8[entryBase + SECOND_AXIS - 1] = 0;
}

/** BUG: retires the bookkeeping and forgets the position entirely. */
function brokenRecordOnly(m, record = m.regs.ix) {
  m.mem8[record] = 0;
}

/** BUG: applies the offset to the wrong base, which reads plausibly and clears a stranger. */
function brokenWrongBase(m, record = m.regs.ix, entryBase = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[entryBase] = 0;
  mem8[record + SECOND_AXIS] = 0;
}

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["neighbour-offset", brokenNeighbourOffset],
  ["record-only", brokenRecordOnly],
  ["wrong-base", brokenWrongBase],
]) {
  test(`TEETH: the ${label} twin is CAUGHT at every crafted base pair`, { skip: SKIP }, () => {
    let caught = 0;
    const n = eachPair((record, entryBase) => {
      if (replay(twin, craft(record, entryBase))) caught++;
    });
    assert.equal(caught, n, `the sweep missed the ${label} twin on ${n - caught} of ${n} pairs`);
    console.log(`  TEETH/${label}: caught on all ${caught} crafted pairs`);
  });

  test(`TEETH: the ${label} twin is CAUGHT at every live real dispatch`, { skip: SKIP }, () => {
    const live = dispatches().filter((s) => !isDegenerate(s));
    assert.ok(live.length > 0, "no live dispatch to test the twin against");
    for (const s of live) {
      const d = replay(twin, s);
      assert.notEqual(d, null, `the ${label} twin passed at record ${hex4(s.regs.ix)}`);
    }
    console.log(`  TEETH/${label}: caught at all ${live.length} live dispatch(es)`);
  });
}

// The twin the single-dispatch gate CANNOT see: it ignores its bases and hard-codes the three
// addresses one real dispatch happened to use. Proving it survives there is the point.

test("TEETH: the PINNED twin survives its own dispatch and dies on every other", { skip: SKIP }, () => {
  const live = dispatches().filter((s) => !isDegenerate(s));
  assert.ok(live.length > 0, "no live dispatch to pin the twin to");
  const pin = live[0];
  const pinnedRecord = pin.regs.ix;
  const pinnedEntry = pin.regs.iy;

  /** BUG: hard-codes one dispatch's addresses and ignores the bases it is handed. */
  const brokenPinned = (m) => {
    const { mem8 } = m;
    mem8[pinnedRecord] = 0;
    mem8[pinnedEntry] = 0;
    mem8[pinnedEntry + SECOND_AXIS] = 0;
  };

  assert.equal(
    replay(brokenPinned, pin),
    null,
    "the pinned twin must be INDISTINGUISHABLE at the dispatch it was pinned to — if it is " +
      "not, this test no longer demonstrates the hole it exists to demonstrate",
  );

  let caught = 0;
  let others = 0;
  eachPair((record, entryBase) => {
    if (record === pinnedRecord && entryBase === pinnedEntry) return;
    others++;
    if (replay(brokenPinned, craft(record, entryBase))) caught++;
  });
  assert.ok(others > 100, "the pair sweep collapsed to almost nothing");
  assert.equal(caught, others, `the pinned twin escaped on ${others - caught} of ${others} pairs`);
  console.log(
    `  TEETH/pinned: invisible at ${hex4(pinnedRecord)}/${hex4(pinnedEntry)}, ` +
      `caught on all ${caught} other pairs`,
  );
});
