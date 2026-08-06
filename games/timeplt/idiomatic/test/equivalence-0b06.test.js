// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b06 — memory-equivalent to the frozen oracle at ROM 0x0B06.
 *
 * GATE: strict unit-capture through unitEquivalence at the real first dispatch, plus crafted
 *   entries for priors the first dispatch does not present. There is NO exclusion window:
 *   the rewrite pushes nothing and the oracle pushes nothing, so no stack scratch diverges and
 *   the RAM diff is the whole contract, uncensored.
 *
 * ★ THE DEGENERACY, MEASURED AND PINNED — this routine's characteristic vacuity risk. It writes
 *   sixteen constants and reads nothing, so at any dispatch whose sixteen cells ALREADY hold
 *   those constants a bare no-op is indistinguishable from the real routine. Over a driven run
 *   that is what nearly every dispatch looks like: the strip is re-stamped on every frame of an
 *   attract step and only the first frame of the step changes anything. The FIRST dispatch —
 *   the one unitEquivalence clones — happens to be one of the few that are NOT degenerate, with
 *   all sixteen cells zero. That is luck, so the "NOT DEGENERATE" arm below asserts it instead
 *   of relying on it, and a larger frame budget could never repair it: the first entry is the
 *   entry that gets cloned.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump.
 *   2. NOT DEGENERATE — that entry's sixteen cells are zero and the routine moves exactly
 *      sixteen bytes there, so arm 1 is a real comparison and not a tautology.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY. Memory-equivalence drops the Z80 register
 *      trace, so `equal` is false for a CORRECT routine; the divergence is pinned to exactly
 *      the eight registers that move, so "excluded" cannot quietly widen.
 *   4. THE WRITE-SET, byte for byte, against a table spelled out in this file.
 *   5. THE REAL CORPUS — every distinct sixteen-cell prior a longer driven run presents,
 *      replayed through both arms, with the degenerate share of dispatches reported.
 *   6. AND WHAT THE CORPUS CANNOT DISCRIMINATE, which is why 5 alone is not reassurance: an
 *      arm proves the no-op twin survives exactly the degenerate priors and dies on the rest.
 *   7. TEETH — five broken twins aimed at five distinct behaviours, each caught by the same
 *      comparison the real arm passes.
 *   8. DROPPED REGISTERS — a whole driven session with every register this rewrite declines to
 *      reproduce forced hostile after each dispatch, with the run asserted to have completed.
 *
 * HOLE: the rest of the machine is fixed at the captured entry. The routine reads nothing, so
 * its only input is the prior content of the sixteen cells it overwrites, and arms 5 and 6 walk
 * that space with every prior the game produces plus one it never does.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0b06.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0b06 } from "../loc_0b06.js";
import { loc_0b06 as oracle } from "../../translated/loc_0b06.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0b06;
const FIRST_ENTRY = 0xaa10;
const PIECES = 4;
const ENTRY_STRIDE = 2;
const SHAPE = 1;
const CONTROL = 48;
const SECOND_AXIS = 49;
const FIXED_AXIS_VALUE = 216;
const CONTROL_VALUE = 108;
const FIRST_SHAPE = 4;
const LEADING_EDGE = 160;
const PIECE_PITCH = 16;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";

// The sixteen cells the routine owns, in address order, and what it must leave in each. The
// table is written out rather than derived from the rewrite, so a rewrite that changes its mind
// about a constant has to disagree with something.
const CELLS = [];
for (let piece = 0; piece < PIECES; piece++) {
  const entry = FIRST_ENTRY + piece * ENTRY_STRIDE;
  CELLS.push(entry, entry + SHAPE, entry + CONTROL, entry + SECOND_AXIS);
}
CELLS.sort((a, b) => a - b);

const EXPECTED = new Map([
  [0xaa10, 216], [0xaa11, 4], [0xaa12, 216], [0xaa13, 5],
  [0xaa14, 216], [0xaa15, 6], [0xaa16, 216], [0xaa17, 7],
  [0xaa40, 108], [0xaa41, 160], [0xaa42, 108], [0xaa43, 144],
  [0xaa44, 108], [0xaa45, 128], [0xaa46, 108], [0xaa47, 112],
]);

const SECOND_AXIS_CELLS = new Set(
  [...Array(PIECES).keys()].map((p) => FIRST_ENTRY + p * ENTRY_STRIDE + SECOND_AXIS),
);

const STAMPED = CELLS.map((c) => EXPECTED.get(c));
const ZEROED = CELLS.map(() => 0);
const HIDDEN = CELLS.map((c, i) => (SECOND_AXIS_CELLS.has(c) ? 0 : STAMPED[i]));
const SCRAMBLED = CELLS.map((_, i) => (i * 37 + 5) & 0xff);

let entry = null;

/** The required contract call, with the pristine entry harvested off the candidate's clone. */
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
  if (entry === null) gate(loc_0b06);
  return entry;
}

function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Oracle vs candidate from the real entry, with the sixteen cells forced to `prior`. */
function craftedDiff(candidate, prior) {
  const a = entryState().clone();
  const b = entryState().clone();
  for (const arm of [a, b]) CELLS.forEach((c, i) => { arm.mem8[c] = prior[i]; });
  oracle(a);
  candidate(b);
  return ramDiff(a, b);
}

/** Every address whose byte the candidate moves, walking the whole dump from `prior`. */
function writeSet(candidate, prior) {
  const before = entryState().clone();
  const after = entryState().clone();
  for (const arm of [before, after]) CELLS.forEach((c, i) => { arm.mem8[c] = prior[i]; });
  candidate(after);
  const da = before.dumpState();
  const db = after.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) out.push(before.stateOffsetToAddr(i));
  return out;
}

/** Longer than the entry window, which is sized to REACH the routine rather than to sample it. */
const CORPUS_FRAMES = 1800;

let corpus = null;

/** Every distinct prior the driven run presents, and how many dispatches carried each. */
function inputCorpus() {
  if (corpus !== null) return corpus;
  const seen = new Map();
  let dispatches = 0;
  const probe = new Map([[TARGET, (mm) => {
    dispatches += 1;
    const prior = CELLS.map((c) => mm.mem8[c]);
    const key = prior.join(",");
    seen.set(key, { prior, count: (seen.get(key)?.count ?? 0) + 1 });
    return oracle(mm);
  }]]);
  const host = makeMachine(probe);
  host.runFrames(CORPUS_FRAMES);
  assert.equal(host.stoppedBy, null, `the corpus run stopped early: ${host.stoppedBy}`);
  corpus = { rows: [...seen.values()], dispatches };
  return corpus;
}

const isDegenerate = (prior) => prior.every((v, i) => v === STAMPED[i]);

const SESSION_FRAMES = 1800;
const DROPPED = ["a", "f", "b", "c", "d", "e", "iy"];

/**
 * Run the whole game twice and diff every frame: once untouched, once with `mutate` applied
 * after each dispatch of the routine. If anything downstream consumes what `mutate` corrupts,
 * the corruption reaches game memory and the two traces separate.
 */
function session(mutate) {
  const base = makeMachine();
  const baseFrames = base.runFrames(SESSION_FRAMES);
  let dispatches = 0;
  const other = makeMachine(new Map([[TARGET, (mm) => {
    dispatches += 1;
    const r = oracle(mm);
    mutate(mm);
    return r;
  }]]));
  const otherFrames = other.runFrames(SESSION_FRAMES);
  const addrs = new Set();
  const n = Math.min(baseFrames.length, otherFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseFrames[i];
    const y = otherFrames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) addrs.add(base.stateOffsetToAddr(o));
  }
  const stopped = base.stoppedBy ?? other.stoppedBy ?? null;
  return { addrs: [...addrs].sort((a, b) => a - b), frames: n, dispatches, stopped };
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_0b06 == oracle on RAM", { skip }, () => {
  const r = gate(loc_0b06);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry reached within ${ENTRY_FRAMES} frames; RAM identical everywhere`);
});

test("NOT DEGENERATE: the captured entry really tests something", { skip }, () => {
  const prior = CELLS.map((c) => entryState().mem8[c]);
  assert.deepEqual(prior, ZEROED, "the first dispatch no longer arrives with the strip clear");
  assert.equal(isDegenerate(prior), false, "the gate would be a tautology at a stamped entry");
  assert.deepEqual(
    writeSet(loc_0b06, prior),
    CELLS,
    "the rewrite must move exactly its sixteen cells from this entry, no more and no fewer",
  );
  console.log(`  NOT DEGENERATE: entry cells all zero; ${CELLS.length} bytes move`);
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_0b06(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    ["a", "f", "b", "c", "d", "e", "iy", "sp"],
    "the excluded set changed shape: only the loop's working registers, the flag byte, the " +
      "entry cursor and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(ramDiff(a, b), null, "the memory contract must still hold");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("WRITE-SET: the sixteen constants land where the table says", { skip }, () => {
  const after = entryState().clone();
  loc_0b06(after);
  for (const [addr, value] of EXPECTED) {
    assert.equal(after.mem8[addr], value, `${hex4(addr)} must hold ${value}`);
  }
  const shapes = [...Array(PIECES).keys()].map((p) => after.mem8[FIRST_ENTRY + p * ENTRY_STRIDE + SHAPE]);
  const edges = [...SECOND_AXIS_CELLS].sort((x, y) => x - y).map((c) => after.mem8[c]);
  assert.deepEqual(shapes, [4, 5, 6, 7], "the shapes must count up, one per piece");
  assert.deepEqual(edges, [160, 144, 128, 112], "the pieces must sit one pitch apart, in order");
  console.log(`  WRITE-SET: shapes ${shapes.join(",")} at ${edges.join(",")}`);
});

test("CRAFTED PRIORS: every starting content of the sixteen cells replays identically", { skip }, () => {
  for (const [label, prior] of [
    ["zeroed", ZEROED],
    ["already stamped", STAMPED],
    ["strip hidden", HIDDEN],
    ["scrambled", SCRAMBLED],
  ]) {
    const d = craftedDiff(loc_0b06, prior);
    assert.equal(d, null, `prior ${label}: ${show(d)}`);
  }
  assert.deepEqual(writeSet(loc_0b06, STAMPED), [], "re-stamping a stamped strip must move nothing");
  assert.deepEqual(
    writeSet(loc_0b06, HIDDEN),
    [...SECOND_AXIS_CELLS].sort((a, b) => a - b),
    "re-showing a hidden strip must touch only the four positions that were cleared",
  );
  console.log("  CRAFTED PRIORS: four priors identical; the stamp is idempotent");
});

test("CORPUS: every prior a longer driven run presents replays identically", { skip }, () => {
  const { rows, dispatches } = inputCorpus();
  assert.ok(rows.length > 0, "vacuous: the longer run never reached the routine either");
  for (const { prior } of rows) {
    const d = craftedDiff(loc_0b06, prior);
    assert.equal(d, null, `a real prior diverged: ${show(d)}`);
  }
  const degenerate = rows.filter((r) => isDegenerate(r.prior)).reduce((n, r) => n + r.count, 0);
  console.log(
    `  CORPUS: ${rows.length} distinct priors over ${dispatches} dispatches in ` +
      `${CORPUS_FRAMES} frames identical; ${degenerate} of those dispatches were degenerate`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless, so each twin below breaks a DIFFERENT behaviour of the
// routine and each must be caught by the same comparison the real arm passes.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: stamps three pieces and leaves the fourth entry exactly as it found it. */
function brokenThreePieces(m) {
  const { mem8 } = m;
  for (let piece = 0; piece < PIECES - 1; piece++) {
    const e = FIRST_ENTRY + piece * ENTRY_STRIDE;
    mem8[e] = FIXED_AXIS_VALUE;
    mem8[e + SHAPE] = FIRST_SHAPE + piece;
    mem8[e + CONTROL] = CONTROL_VALUE;
    mem8[e + SECOND_AXIS] = LEADING_EDGE - piece * PIECE_PITCH;
  }
}

/** BUG: every piece lands on the leading edge, so the strip collapses into one pile. */
function brokenFlatPitch(m) {
  const { mem8 } = m;
  for (let piece = 0; piece < PIECES; piece++) {
    const e = FIRST_ENTRY + piece * ENTRY_STRIDE;
    mem8[e] = FIXED_AXIS_VALUE;
    mem8[e + SHAPE] = FIRST_SHAPE + piece;
    mem8[e + CONTROL] = CONTROL_VALUE;
    mem8[e + SECOND_AXIS] = LEADING_EDGE;
  }
}

/** BUG: the shapes count down, so the pieces of the strip come out back to front. */
function brokenShapesDescending(m) {
  const { mem8 } = m;
  for (let piece = 0; piece < PIECES; piece++) {
    const e = FIRST_ENTRY + piece * ENTRY_STRIDE;
    mem8[e] = FIXED_AXIS_VALUE;
    mem8[e + SHAPE] = FIRST_SHAPE + PIECES - 1 - piece;
    mem8[e + CONTROL] = CONTROL_VALUE;
    mem8[e + SECOND_AXIS] = LEADING_EDGE - piece * PIECE_PITCH;
  }
}

/** BUG: the two bytes of the parallel half go in the other way round. */
function brokenHalvesSwapped(m) {
  const { mem8 } = m;
  for (let piece = 0; piece < PIECES; piece++) {
    const e = FIRST_ENTRY + piece * ENTRY_STRIDE;
    mem8[e] = FIXED_AXIS_VALUE;
    mem8[e + SHAPE] = FIRST_SHAPE + piece;
    mem8[e + CONTROL] = LEADING_EDGE - piece * PIECE_PITCH;
    mem8[e + SECOND_AXIS] = CONTROL_VALUE;
  }
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["three-pieces", brokenThreePieces],
  ["flat-pitch", brokenFlatPitch],
  ["shapes-descending", brokenShapesDescending],
  ["halves-swapped", brokenHalvesSwapped],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT by unitEquivalence`, { skip }, () => {
    const r = gate(twin);
    assert.notEqual(r.ram, null, `the contract call PASSED the ${label} twin — it has no teeth`);
    assert.equal(r.equal, false, "a RAM divergence must fail the whole comparison");
    console.log(`  TEETH/${label}: caught by the contract call — ${show(r.ram)}`);
  });

  test(`TEETH: the ${label} twin is CAUGHT from a scrambled prior too`, { skip }, () => {
    const d = craftedDiff(twin, SCRAMBLED);
    assert.notEqual(d, null, `the crafted space PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: caught on the scrambled prior — ${show(d)}`);
  });
}

test("TEETH: the degenerate priors are BLIND to two twins, and the others are not", { skip }, () => {
  const blind = TWINS.filter(([, twin]) => !craftedDiff(twin, STAMPED)).map(([label]) => label);
  assert.deepEqual(
    blind,
    ["no-op", "three-pieces"],
    "the set of behaviours an already-stamped entry cannot discriminate moved — re-derive it",
  );
  for (const label of blind) {
    const twin = TWINS.find(([l]) => l === label)[1];
    assert.notEqual(craftedDiff(twin, ZEROED), null, `${label} escapes the real first entry too`);
    assert.notEqual(craftedDiff(twin, HIDDEN), null, `${label} escapes the hidden-strip prior too`);
  }
  const { rows } = inputCorpus();
  for (const { prior } of rows) {
    const caught = craftedDiff(brokenNoOp, prior) !== null;
    assert.equal(caught, !isDegenerate(prior), "a prior discriminated the no-op twin only if it was not degenerate");
  }
  console.log(`  TEETH: an already-stamped entry cannot see ${blind.join(", ")}; other priors can`);
});

// ── the registers this rewrite declines to reproduce ─────────────────────────────────────

test("DROPPED REGISTERS: they steer nothing, measured over a whole driven session", { skip }, () => {
  const r = session((mm) => {
    for (const k of DROPPED) mm.regs[k] = k === "iy" ? 0x5a5a : 0x5a;
    mm.regs.f = 0xff;
  });
  assert.ok(r.dispatches > 0, "the instrument never reached the routine, so it measured nothing");
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped}); a truncated trace reads as a pass`);
  assert.equal(r.frames, SESSION_FRAMES, `compared ${r.frames} of ${SESSION_FRAMES} frames`);
  assert.deepEqual(
    r.addrs,
    [],
    "a hostile value in a register this rewrite drops reached game memory: some caller CONSUMES " +
      "it, the live-out claim is wrong, and the routine must reproduce it",
  );
  console.log(
    `  DROPPED REGISTERS: hostile ${DROPPED.join(",")} on all ${r.dispatches} dispatches over ` +
      `${r.frames} frames left no trace`,
  );
});

test("TEETH: corrupting what the routine DOES write forks the run", { skip }, () => {
  const r = session((mm) => { mm.mem8[FIRST_ENTRY + SECOND_AXIS] = 0; });
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped}); the instrument proves nothing`);
  assert.equal(r.frames, SESSION_FRAMES, `compared ${r.frames} of ${SESSION_FRAMES} frames`);
  assert.ok(
    r.addrs.length > 0,
    "clearing one of the routine's own cells after every dispatch left the machine identical, " +
      "so this instrument never reaches the routine and the arm above proves nothing",
  );
  console.log(
    `  TEETH/write-set: clearing one written cell diverges at ` +
      `${r.addrs.map(hex4).join(" ")} — the arm above is wired`,
  );
});
