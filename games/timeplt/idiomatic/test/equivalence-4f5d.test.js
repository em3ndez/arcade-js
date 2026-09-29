// SPDX-License-Identifier: GPL-3.0-only
/**
 * stagePlayerShotSweepAgainstTargetsAndRun — memory-equivalent to the frozen oracle at ROM 0x4F5D.
 *
 * Strict unit-capture, a corpus replay of every dispatch of a driven session, and a crafted arm
 * that puts targets under the shots so the sweep this entry starts actually does something.
 *
 * EQUAL at the real dispatch agrees byte for byte, the stack scratch INCLUDED, so this file names
 * NO memory exclusion and asserts the empty one — everything this entry hands over to is already
 * stack-free. The rewrite hands the sweep its eight inputs as ARGUMENTS, not registers, so the
 * frozen side's register hand-over is harvested AT the hand-over by a spy wired in place of the
 * sweep, and the HAND-OVER arm replays the sweep from exactly that harvest against the rewrite, byte
 * for byte, on every judging state — where the twins below show each of the eight inputs moves the
 * result, so agreement there pins every one. Registers left AFTERWARDS are not a live-out: the only
 * caller hands every later sweep its inputs as arguments and reads no register back. The two
 * CURSOR CELLS the sweep reloads between passes are compared as memory.
 * THE SWEEP REALLY RUNS is crafted: a target placed on top of a shot, both shown destroyed —
 * without it the file could pass on a machine where nothing ever hits. TEETH: eight twins, one per
 * handed-over input, each on an exact count over nine judging states (the real dispatch and eight
 * crafted placements chosen to discriminate the counts and the box).
 *
 * HOLE: what the sweep DOES is gated elsewhere; this file fixes the eight things this entry chooses
 * and that it then runs the sweep. HOLE: the crafted hit forces ONE overlap at one slot.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4f5d.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stagePlayerShotSweepAgainstTargetsAndRun } from "../stagePlayerShotSweepAgainstTargetsAndRun.js";
import { loc_4f5d as oracle } from "../../translated/loc_4f5d.js";
import { destroyTargetsHitByShots } from "../destroyTargetsHitByShots.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x4f5d;

const TARGET_RECORDS = 0xa8c0;
const TARGET_ENTRIES = 0xaa28;
const SHOT_RECORDS = 0xaa80;
const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;
const LIVE = 255;
const DESTROYED = 240;
const SHOT_FIRST_AXIS = 6;
const SHOT_SECOND_AXIS = 4;
const ENTRY_SECOND_AXIS = 49;

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 152;

/** The registers the frozen entry hands the sweep. */
const STAGED = ["b", "c", "h", "l", "a_"];

/** The sweep this entry stages and then runs; wired to a spy to harvest the hand-over. */
const SWEEP = 0x5211;

/**
 * The dead stack scratch a crafted hit dirties: the frozen scoring chain the sweep reaches
 * brackets its work with pushes the stack-free rewrite does not make. Measured as an upper bound;
 * no real dispatch of this entry dirties anything, which the first arm asserts.
 */
const SCRATCH_BYTES = 8;

/**
 * The registers allowed to diverge — a BOUND, not an exact list: one diverging outside this set
 * fails the arm below, and a rewrite diverging on fewer still passes. Two groups, neither a
 * live-out: the frozen hand-over itself (the rewrite passes those values as arguments and leaves
 * the registers alone; THE HAND-OVER arm pins the values), and the sweep's leftovers (frozen runs
 * the count and the shot cursor down, stack-free keeps cursors in locals).
 */
const EXCLUDED = ["a", "f", "sp", ...STAGED, "d", "e", "ix", "iy"];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Those divergences falling OUTSIDE the dead scratch window below the entry stack pointer. */
function outsideScratch(a, b, sp) {
  return allDiffs(a, b).filter((d) => d.addr < sp - SCRATCH_BYTES || d.addr >= sp);
}

/** Oracle vs candidate on two clones, masked. */
function compare(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return outsideScratch(a, b, sp)[0] ?? null;
}

/**
 * What the ORACLE hands the sweep, harvested at the hand-over by a spy wired in place of it.
 * Comparing registers AFTERWARDS cannot answer this: the frozen sweep consumes two of them and
 * the stack-free one leaves them standing, so an after-the-fact comparison measures the sweep.
 */
function stagedByOracle(machine) {
  let seen = null;
  const spied = machine.clone();
  spied.routines = new Map(spied.routines);
  spied.routines.set(SWEEP, (mm) => {
    seen = Object.fromEntries(
      [...STAGED, "de", "ix", "iy"].map((k) => [k, mm.regs[k]]),
    );
  });
  oracle(spied);
  assert.notEqual(seen, null, "the oracle did not reach the sweep at all");
  return { staged: seen, machine: spied };
}

/** The sweep run from exactly what the frozen entry hands it: its harvested registers and cells. */
function sweepFromOracleHandOver(machine) {
  const { staged, machine: spied } = stagedByOracle(machine);
  const m = machine.clone();
  m.mem16[TARGET_RECORD_CURSOR] = spied.mem16[TARGET_RECORD_CURSOR];
  m.mem16[TARGET_ENTRY_CURSOR] = spied.mem16[TARGET_ENTRY_CURSOR];
  destroyTargetsHitByShots(m, staged.ix, staged.iy, staged.de, staged.b, staged.a_, staged.c, staged.l, staged.h);
  return m;
}

let captured = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  return { dispatches, caught };
}

function entryState() {
  if (captured === null) replay(stagePlayerShotSweepAgainstTargetsAndRun);
  return captured;
}

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;
const SHOT_AT = 100;
const OTHER_AXIS_AT = 120;

/**
 * A real captured machine with every shot and target slot cleared, then one live shot and one
 * live target placed at chosen slots a chosen distance apart along the first axis. The distance
 * is what discriminates the two numbers that size the box; the slots are what discriminate the
 * two counts and the cursor restaging.
 */
function craftCase({ shotSlot = 0, targetSlot = 0, offset = 0 }) {
  const m = entryState().clone();
  for (let i = 0; i < 6; i++) m.mem8[SHOT_RECORDS + RECORD_STRIDE * i] = 0;
  for (let i = 0; i < 3; i++) m.mem8[TARGET_RECORDS + RECORD_STRIDE * i] = 0;

  const shot = SHOT_RECORDS + RECORD_STRIDE * shotSlot;
  m.mem8[shot] = LIVE;
  m.mem8[shot + SHOT_FIRST_AXIS] = SHOT_AT;
  m.mem8[shot + SHOT_SECOND_AXIS] = OTHER_AXIS_AT;

  m.mem8[TARGET_RECORDS + RECORD_STRIDE * targetSlot] = LIVE;
  const entry = TARGET_ENTRIES + ENTRY_STRIDE * targetSlot;
  m.mem8[entry] = SHOT_AT + offset;
  m.mem8[entry + ENTRY_SECOND_AXIS] = OTHER_AXIS_AT;
  return m;
}

const craftHit = () => craftCase({});

/** The states every twin is judged on: the real entry, and eight crafted placements. */
function judgingStates() {
  return [
    entryState(),
    craftCase({}),
    craftCase({ shotSlot: 5 }),
    craftCase({ targetSlot: 2 }),
    craftCase({ shotSlot: 5, targetSlot: 2 }),
    craftCase({ offset: 7 }),
    craftCase({ offset: 8 }),
    craftCase({ offset: -7 }),
    craftCase({ offset: -8 }),
  ];
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: every byte identical, the stack scratch included", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  stagePlayerShotSweepAgainstTargetsAndRun(b);
  assert.deepEqual(allDiffs(a, b), [], `a byte diverged — ${show(allDiffs(a, b)[0])}`);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(
    `  EQUAL: entry sp=${hex4(entry.regs.sp)}; every byte identical, registers moved: ${moved.join(", ")}`,
  );
});

test("THE HAND-OVER: the sweep run from the frozen harvest matches the rewrite on every judging state", { skip }, () => {
  const { staged } = stagedByOracle(entryState());
  assert.equal(staged.de, TARGET_RECORDS, "the target record run moved");
  assert.equal(staged.iy, TARGET_ENTRIES, "the target entry run moved");
  assert.equal(staged.ix, SHOT_RECORDS, "the shot run moved");
  let states = 0;
  for (const machine of judgingStates()) {
    const a = sweepFromOracleHandOver(machine);
    const b = machine.clone();
    stagePlayerShotSweepAgainstTargetsAndRun(b);
    assert.deepEqual(allDiffs(a, b), [], `the hand-over diverged — ${show(allDiffs(a, b)[0])}`);
    states++;
  }
  // The arm has teeth: a hand-over one input off, replayed the same way, is seen.
  const off = (machine) => {
    const { staged: h } = stagedByOracle(machine);
    const m = machine.clone();
    stage(m, { span: h.h + 1 });
    return m;
  };
  const seen = judgingStates().filter((machine) => allDiffs(sweepFromOracleHandOver(machine), off(machine)).length > 0).length;
  assert.ok(seen > 0, "a hand-over with the box one wider matched the harvest everywhere, so this arm is blind");
  console.log(
    `  HAND-OVER: ${Object.entries(staged).map(([k, v]) => `${k}=${v}`).join(" ")}; ${states} states identical, ` +
      `a one-off hand-over seen on ${seen}`,
  );
});

test("THE CURSOR CELLS: both are restaged to the runs this entry chose", { skip }, () => {
  const m = entryState().clone();
  oracle(m);
  assert.equal(m.mem16[TARGET_RECORD_CURSOR], TARGET_RECORDS, "the record cursor cell moved");
  assert.equal(m.mem16[TARGET_ENTRY_CURSOR], TARGET_ENTRIES, "the entry cursor cell moved");
  console.log(
    `  CURSORS: ${hex4(TARGET_RECORD_CURSOR)}=${hex4(m.mem16[TARGET_RECORD_CURSOR])}, ` +
      `${hex4(TARGET_ENTRY_CURSOR)}=${hex4(m.mem16[TARGET_ENTRY_CURSOR])}`,
  );
});

test("THE SWEEP REALLY RUNS: a crafted overlap destroys both slots, on both sides", { skip }, () => {
  const a = craftHit();
  const b = craftHit();
  const sp = a.regs.sp;
  oracle(a);
  stagePlayerShotSweepAgainstTargetsAndRun(b);
  assert.equal(a.mem8[TARGET_RECORDS], DESTROYED, "the crafted overlap did not destroy the target");
  assert.equal(a.mem8[SHOT_RECORDS], DESTROYED, "the crafted overlap did not spend the shot");
  assert.deepEqual(
    outsideScratch(a, b, sp),
    [],
    `the rewrite diverged on the crafted hit — ${show(outsideScratch(a, b, sp)[0])}`,
  );
  console.log("  SWEEP RUNS: the crafted overlap destroys target and shot on both sides");
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(stagePlayerShotSweepAgainstTargetsAndRun);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  console.log(`  CORPUS: ${r.dispatches} dispatches identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin stages one thing wrong and then runs the same sweep, so a catch measures the
// staging and not the sweep.

function stage(m, o) {
  m.mem16[TARGET_RECORD_CURSOR] = o.recordCursor ?? TARGET_RECORDS;
  m.mem16[TARGET_ENTRY_CURSOR] = o.entryCursor ?? TARGET_ENTRIES;
  destroyTargetsHitByShots(
    m,
    o.shots ?? SHOT_RECORDS,
    o.targetEntries ?? TARGET_ENTRIES,
    o.targetRecords ?? TARGET_RECORDS,
    o.targetsFirstPass ?? 3,
    o.targetsPerPass ?? 3,
    o.shotCount ?? 6,
    o.reach ?? 7,
    o.span ?? 15,
  );
}

// The two target counts, each moved alone: measured, so each is pinned independently of the other.
const FIRST_PASS_SHORT = 1;
const LATER_PASSES_SHORT = 1;

const TWINS = [
  ["no-op", () => {}, 9],
  ["wrong-target-run", (m) => stage(m, { targetRecords: TARGET_RECORDS + 16 }), 4],
  ["wrong-shot-run", (m) => stage(m, { shots: SHOT_RECORDS + 16 }), 4],
  ["one-target-short", (m) => stage(m, { targetsFirstPass: 2, targetsPerPass: 2 }), 2],
  ["first-pass-one-short", (m) => stage(m, { targetsFirstPass: 2 }), FIRST_PASS_SHORT],
  ["later-passes-one-short", (m) => stage(m, { targetsPerPass: 2 }), LATER_PASSES_SHORT],
  ["one-shot-short", (m) => stage(m, { shotCount: 5 }), 2],
  ["reach-off-by-one", (m) => stage(m, { reach: 8 }), 2],
  ["span-off-by-one", (m) => stage(m, { span: 16 }), 1],
  ["cursors-not-restaged", (m) => stage(m, { recordCursor: 0, entryCursor: 0 }), 9],
];

function twinCaught(candidate) {
  let caught = 0;
  for (const machine of judgingStates()) if (compare(candidate, machine)) caught++;
  return caught;
}

const STATES = 9;

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the states`, { skip }, () => {
    assert.equal(twinCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${STATES} states`);
  });
}

test("THE JUDGING SET IS NOT VACUOUS: the rewrite passes every state in it", { skip }, () => {
  assert.equal(twinCaught(stagePlayerShotSweepAgainstTargetsAndRun), 0, "the rewrite itself fails one of the judging states");
  const hits = judgingStates().filter((machine) => {
    const m = machine.clone();
    oracle(m);
    return m.mem8[TARGET_RECORDS] === DESTROYED ||
      m.mem8[TARGET_RECORDS + RECORD_STRIDE * 2] === DESTROYED;
  }).length;
  assert.ok(hits > 0, "no judging state produces a hit, so the destroying arm is untested");
  console.log(`  JUDGING SET: ${STATES} states, ${hits} of them produce a destroyed target`);
});
