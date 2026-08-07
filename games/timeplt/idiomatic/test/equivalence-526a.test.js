// SPDX-License-Identifier: GPL-3.0-only
/**
 * emptyBothDeferredCellLists — memory-equivalent to the frozen oracle at ROM 0x526A.
 *
 * GATE: strict unit-capture with NO exclusion — not even a stack window, because the frozen
 *   routine pushes nothing — plus an exhaustive sweep of the routine's whole input space, plus a
 *   declared live-out comparison, plus teeth.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — the whole state dump, stack included.
 *   2. STORES — the four bytes really do carry the two cursors afterwards, from arbitrary
 *      priors, so the comparison is not agreeing on a no-change.
 *   3. LIVE-OUT — the register pair the frozen routine leaves the second cursor in is compared
 *      explicitly. RAM equality is blind to it: the twin that drops it passes every other arm,
 *      which this file measures rather than assumes.
 *   4. CORPUS — every dispatch of a driven and an undriven session, counts asserted. Two
 *      distinct entry stack pointers occur, which is asserted too, because the strict arm's
 *      claim that nothing at all is pushed has to hold at both.
 *   5. EXCLUDED — the register divergence is pinned to the stack pointer ALONE, since the frozen
 *      routine sets no flag and touches no other register.
 *   6. EXHAUSTIVE — the routine reads nothing, so its input space is the prior content of the
 *      four bytes it writes. All four are swept over 0..255 together and crossed.
 *   7. TEETH — five twins, each caught on an exact count of priors.
 *
 * HOLE: one captured backdrop. Only the four written bytes are varied; nothing else can matter,
 * because the routine reads no cell at all.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-526a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { emptyBothDeferredCellLists } from "../emptyBothDeferredCellLists.js";
import { loc_526a as oracle } from "../../translated/loc_526a.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { DEFERRED_WRITE_CURSOR, DEFERRED_BLANK_CURSOR } from "../names.js";

const TARGET = 0x526a;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const FIRST_ENTRY = 4;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 1766, attract: 846 };
/** The entry stack pointers real play presents. Measured, and asserted as a set. */
const REAL_STACK_POINTERS = [0xafe8, 0xaffe];

const EXCLUDED = ["sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry, and the comparison ───────────────────────────────────────────────────────

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
  if (entry === null) gate(emptyBothDeferredCellLists);
  return entry;
}

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** RAM first, then the register pair the frozen routine leaves the second cursor in. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b)[0];
  if (ram) return ram;
  if (a.regs.hl !== b.regs.hl) return { addr: null, a: a.regs.hl, b: b.regs.hl };
  return null;
}

/** A real captured machine with all four written bytes forced. */
function craft(low, high) {
  const m = entryState().clone();
  m.mem8[DEFERRED_BLANK_CURSOR] = low;
  m.mem8[DEFERRED_BLANK_CURSOR + 1] = high;
  m.mem8[DEFERRED_WRITE_CURSOR] = high;
  m.mem8[DEFERRED_WRITE_CURSOR + 1] = low;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (let v = 0; v < 256; v++) {
    if (unitDiff(candidate, craft(v, v))) caught++;
    if (unitDiff(candidate, craft(v, 255 - v))) caught++;
  }
  return caught;
}

const SWEEP_SIZE = 512;

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const stackPointers = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      stackPointers.add(mm.regs.sp);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, stackPointers };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, emptyBothDeferredCellLists) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: only the second list is emptied. */
function brokenOnlyOneList(m) {
  m.mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
  m.regs.hl = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
}

/** BUG: the cursor is parked on the head itself instead of past it. */
function brokenParksOnTheHead(m) {
  m.mem16[DEFERRED_BLANK_CURSOR] = DEFERRED_BLANK_CURSOR;
  m.mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_WRITE_CURSOR;
  m.regs.hl = DEFERRED_WRITE_CURSOR;
}

/** BUG: each cursor is parked on the OTHER list's first entry. */
function brokenCrossesTheLists(m) {
  m.mem16[DEFERRED_BLANK_CURSOR] = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
  m.mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_BLANK_CURSOR + FIRST_ENTRY;
  m.regs.hl = DEFERRED_BLANK_CURSOR + FIRST_ENTRY;
}

/** BUG: the cursors land right but the register pair is left holding whatever it had. */
function brokenDropsTheLiveOut(m) {
  m.mem16[DEFERRED_BLANK_CURSOR] = DEFERRED_BLANK_CURSOR + FIRST_ENTRY;
  m.mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
}

const TWINS = [
  ["no-op", brokenNoOp, 512],
  ["only-one-list", brokenOnlyOneList, 512],
  ["parks-on-the-head", brokenParksOnTheHead, 512],
  ["crosses-the-lists", brokenCrossesTheLists, 512],
  ["drops-the-live-out", brokenDropsTheLiveOut, 512],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: the whole dump, stack included", { skip }, () => {
  const r = gate(emptyBothDeferredCellLists);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `a byte diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry sp=${hex4(entryState().regs.sp)}; identical, stack included`);
});

test("STORES: both cursors carry their own first entry, from arbitrary priors", { skip }, () => {
  const m = craft(0x5a, 0xa5);
  emptyBothDeferredCellLists(m);
  assert.equal(m.mem16[DEFERRED_BLANK_CURSOR], DEFERRED_BLANK_CURSOR + FIRST_ENTRY, "the first cursor did not move");
  assert.equal(
    m.mem16[DEFERRED_WRITE_CURSOR],
    DEFERRED_WRITE_CURSOR + FIRST_ENTRY,
    "the second cursor did not move",
  );
  console.log(
    `  STORES: ${hex4(DEFERRED_BLANK_CURSOR)} -> ${hex4(DEFERRED_BLANK_CURSOR + FIRST_ENTRY)}, ` +
      `${hex4(DEFERRED_WRITE_CURSOR)} -> ${hex4(DEFERRED_WRITE_CURSOR + FIRST_ENTRY)}`,
  );
});

test("LIVE-OUT: the second cursor is left in a register pair, and RAM is blind to it", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  emptyBothDeferredCellLists(b);
  assert.equal(a.regs.hl, b.regs.hl, "the register pair left behind diverged");
  assert.equal(a.regs.hl, DEFERRED_WRITE_CURSOR + FIRST_ENTRY, "the pair does not hold the second cursor");

  const blind = entryState().clone();
  const frozen = entryState().clone();
  oracle(frozen);
  brokenDropsTheLiveOut(blind);
  assert.deepEqual(allDiffs(frozen, blind), [], "the dropped-live-out twin is visible in RAM, so " +
    "this arm is no longer the only thing holding the routine to it");
  assert.notEqual(frozen.regs.hl, blind.regs.hl, "the twin must differ where RAM cannot see");
  console.log(`  LIVE-OUT: the pair holds ${hex4(a.regs.hl)}; the dropping twin is RAM-identical`);
});

test("CORPUS: every dispatch of two whole sessions replays identically", { skip }, () => {
  let total = 0;
  const pointers = new Set();
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    for (const sp of s.stackPointers) pointers.add(sp);
    total += s.dispatches;
  }
  assert.deepEqual(
    [...pointers].sort((x, y) => x - y),
    REAL_STACK_POINTERS,
    "the set of entry stack pointers moved",
  );
  console.log(
    `  CORPUS: ${total} dispatches over ${TAPES.length} sessions, identical at both entry ` +
      `stack pointers ${[...pointers].sort((x, y) => x - y).map(hex4).join(", ")}`,
  );
});

test("EXCLUDED, deliberately: the stack pointer and pc, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  emptyBothDeferredCellLists(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    EXCLUDED,
    "the excluded set changed shape: this routine sets no flag and moves no other register",
  );
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc — the flag byte is NOT among them`);
});

test("EXHAUSTIVE: every prior of the four written bytes lands the same way", { skip }, () => {
  assert.equal(sweepCaught(emptyBothDeferredCellLists), 0, "the rewrite diverged somewhere in the crafted space");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} prior pairs identical, in step and crossed`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of priors`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${SWEEP_SIZE} priors`);
  });
}
