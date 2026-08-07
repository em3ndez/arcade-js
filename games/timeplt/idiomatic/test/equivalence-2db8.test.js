// SPDX-License-Identifier: GPL-3.0-only
/**
 * startNextRound — memory-equivalent to the frozen oracle at ROM 0x2DB8.
 *
 * ★ REACHED BY TWO POKES, AND THE CONTROL SAYS SO. This runs when a round ENDS, which needs the
 *   kill quota emptied and a flag set that only the end-of-wave path sets; no run this harness can
 *   drive plays that far. The gate holds those two cells and lets the once-per-frame caller
 *   dispatch the routine itself with the rest of the machine coherent, and an arm asserts the
 *   unpoked run reaches it zero times.
 *
 * GATE: poked-natural dispatch, every captured dispatch replayed, an exhaustive sweep of the round
 *   counter, a crafted sweep of the era cell, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included.
 *   2. NOT VACUOUS — a no-op candidate fails the same diff.
 *   3. EXCLUDED, deliberately, pinned to an exact set.
 *   4. CORPUS — every dispatch the poked run produces, with the rounds and eras it presented.
 *   5. EXHAUSTIVE ROUND — all 256 values of the round counter, which is the only thing choosing
 *      between the three difficulty cells; the real corpus reaches only the first of the three.
 *   6. EXHAUSTIVE ERA — all 256 values of the era cell, which covers the wrap and the values
 *      outside its ordinary range.
 *   7. THE ERA WRAPS AT FIVE — the era after each of the six values around the wrap is asserted,
 *      so "rolls forward and starts again" is checked rather than described.
 *   8. WHOLE-MACHINE — the poked session replayed with the rewrite wired through a measured shim.
 *   9. TEETH — nine twins, each caught on an exact declared count. Four are INVISIBLE at the
 *      real dispatch, whose round and era sit where the correct and the broken answers coincide.
 *
 * HOLE: poking the kill quota to zero and the flag to one forces the end-of-round path from a
 *   state real play would have arrived at differently. The dispatch is genuine and the machine is
 *   coherent; what the surrounding game state MEANS at that moment is not evidence here.
 * HOLE: nothing checks that the three difficulty cells hold sensible values, only that the right
 *   one is copied. What they mean in play is outside this file.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2db8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { startNextRound } from "../startNextRound.js";
import { loc_2db8 as oracle } from "../../translated/loc_2db8.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { ERA_INDEX, KILLS_REMAINING, KILL_QUOTA, ROUND_NUMBER, START_RUNG_ROUNDS_1_5, START_RUNG_ROUNDS_6_10, START_RUNG_ROUNDS_11_UP, MOTHER_SHIP_ARMED } from "../names.js";

const TARGET = 0x2db8;

const ERAS = 5;
const SECOND_BRACKET_FROM = 6;
const THIRD_BRACKET_FROM = 11;
const DIFFICULTY = 0xad0a;
const ROUND_OVER_FLAG = 0xacc6;
const ARMED_FLAG = 0xad0e;
const ARMED = 0xff;

/** The two cells the pokes hold, and the frame they come on. */
const POKE_FROM_FRAME = 1300;

const MOVED = ["a", "f", "h", "l", "sp"];
const FRAMES = 2400;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 3;

const BYTES = Array.from({ length: 256 }, (_unused, v) => v);
const SWEEP_SIZE = 2 * BYTES.length;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function factory(overrides, poked = true) {
  const m = makeMachine(overrides);
  if (poked) {
    m.pokes = [
      { addr: KILLS_REMAINING, val: 0, frame: POKE_FROM_FRAME, dur: null },
      { addr: ROUND_OVER_FLAG, val: 1, frame: POKE_FROM_FRAME, dur: null },
    ];
  }
  return m;
}

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: FRAMES });
}

function entryState() {
  if (entry === null) gate(startNextRound);
  return entry;
}

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const caught = (candidate, machine) => unitDiff(candidate, machine) !== null;
const shapeOf = (m) => `${m.mem8[ROUND_NUMBER]}/${m.mem8[ERA_INDEX]}`;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const shapes = new Set();
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    shapes.add(shapeOf(mm));
    return oracle(mm);
  }]]));
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "corpus run ran short");
  corpus = { entries, shapes };
  return corpus;
}

const withRound = (round) => {
  const m = entryState().clone();
  m.mem8[ROUND_NUMBER] = round;
  return m;
};

const withEra = (era) => {
  const m = entryState().clone();
  m.mem8[ERA_INDEX] = era;
  return m;
};

const sweepCaught = (candidate) =>
  BYTES.filter((v) => caught(candidate, withRound(v))).length +
  BYTES.filter((v) => caught(candidate, withEra(v))).length;

// ── the shim, measured rather than asserted ─────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

function tail(m, difficulty) {
  m.mem8[DIFFICULTY] = m.mem8[difficulty];
  m.mem8[KILLS_REMAINING] = m.mem8[KILL_QUOTA];
  m.mem8[MOTHER_SHIP_ARMED] = 0;
  m.mem8[ROUND_OVER_FLAG] = 0;
  m.mem8[ARMED_FLAG] = ARMED;
}

function bracketOf(round) {
  if (round < SECOND_BRACKET_FROM) return START_RUNG_ROUNDS_1_5;
  if (round < THIRD_BRACKET_FROM) return START_RUNG_ROUNDS_6_10;
  return START_RUNG_ROUNDS_11_UP;
}

function correctEra(m) {
  const next = (m.mem8[ERA_INDEX] + 1) & 0xff;
  m.mem8[ERA_INDEX] = next < ERAS ? next : 0;
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the round counter never moves, so the difficulty brackets are never reached. */
function brokenNoRoundStep(m) {
  correctEra(m);
  tail(m, bracketOf(m.mem8[ROUND_NUMBER]));
}

/** BUG: the era climbs without ever wrapping, so it runs past the last one. */
function brokenEraNeverWraps(m) {
  m.mem8[ROUND_NUMBER] = m.mem8[ROUND_NUMBER] + 1;
  m.mem8[ERA_INDEX] = m.mem8[ERA_INDEX] + 1;
  tail(m, bracketOf(m.mem8[ROUND_NUMBER]));
}

/** BUG: the era wraps one late, so a sixth era appears that nothing else expects. */
function brokenEraWrapsLate(m) {
  m.mem8[ROUND_NUMBER] = m.mem8[ROUND_NUMBER] + 1;
  const next = (m.mem8[ERA_INDEX] + 1) & 0xff;
  m.mem8[ERA_INDEX] = next < ERAS + 1 ? next : 0;
  tail(m, bracketOf(m.mem8[ROUND_NUMBER]));
}

/** BUG: the bracket is chosen from the round counter BEFORE it is stepped, so it lags a round. */
function brokenBracketFromOldRound(m) {
  const before = m.mem8[ROUND_NUMBER];
  m.mem8[ROUND_NUMBER] = before + 1;
  correctEra(m);
  tail(m, bracketOf(before));
}

/** BUG: the hardest difficulty is never selected, so the game stops escalating. */
function brokenNoHardBracket(m) {
  m.mem8[ROUND_NUMBER] = m.mem8[ROUND_NUMBER] + 1;
  correctEra(m);
  const round = m.mem8[ROUND_NUMBER];
  tail(m, round < SECOND_BRACKET_FROM ? START_RUNG_ROUNDS_1_5 : START_RUNG_ROUNDS_6_10);
}

/** BUG: the kill quota is not refilled, so the next round is over the moment it starts. */
function brokenNoQuota(m) {
  m.mem8[ROUND_NUMBER] = m.mem8[ROUND_NUMBER] + 1;
  correctEra(m);
  m.mem8[DIFFICULTY] = m.mem8[bracketOf(m.mem8[ROUND_NUMBER])];
  m.mem8[MOTHER_SHIP_ARMED] = 0;
  m.mem8[ROUND_OVER_FLAG] = 0;
  m.mem8[ARMED_FLAG] = ARMED;
}

/** BUG: the armed flag is left clear rather than set to all-ones. */
function brokenNotArmed(m) {
  m.mem8[ROUND_NUMBER] = m.mem8[ROUND_NUMBER] + 1;
  correctEra(m);
  m.mem8[DIFFICULTY] = m.mem8[bracketOf(m.mem8[ROUND_NUMBER])];
  m.mem8[KILLS_REMAINING] = m.mem8[KILL_QUOTA];
  m.mem8[MOTHER_SHIP_ARMED] = 0;
  m.mem8[ROUND_OVER_FLAG] = 0;
  m.mem8[ARMED_FLAG] = 0;
}

/** BUG: the round-over flag is left set, so the round ends again on the next frame. */
function brokenFlagNotCleared(m) {
  m.mem8[ROUND_NUMBER] = m.mem8[ROUND_NUMBER] + 1;
  correctEra(m);
  m.mem8[DIFFICULTY] = m.mem8[bracketOf(m.mem8[ROUND_NUMBER])];
  m.mem8[KILLS_REMAINING] = m.mem8[KILL_QUOTA];
  m.mem8[MOTHER_SHIP_ARMED] = 0;
  m.mem8[ARMED_FLAG] = ARMED;
}

/** Per twin: exact catch count over both 256-value sweeps, and its verdict at the real dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 512, true],
  ["no-round-step", brokenNoRoundStep, 512, true],
  ["era-never-wraps", brokenEraNeverWraps, 251, false],
  ["era-wraps-late", brokenEraWrapsLate, 1, false],
  ["bracket-from-old-round", brokenBracketFromOldRound, 3, false],
  ["no-hard-bracket", brokenNoHardBracket, 245, false],
  ["no-quota", brokenNoQuota, 512, true],
  ["not-armed", brokenNotArmed, 512, true],
  ["flag-not-cleared", brokenFlagNotCleared, 512, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("NEGATIVE CONTROL: without the pokes the game never dispatches it", { skip }, () => {
  assert.throws(
    () => unitEquivalence((o) => factory(o, false), TARGET, oracle, startNextRound, { maxFrames: FRAMES }),
    /never entered/,
    "an unpoked run reached the end-of-round path, so the pokes are not what makes it reachable",
  );
  console.log("  CONTROL: zero dispatches in an unpoked run of the same length");
});

test("EQUAL at the real dispatch: startNextRound == oracle on the whole dump", { skip }, () => {
  const r = gate(startNextRound);
  assert.notEqual(entry, null, "vacuous: the poked run never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry round/era ${shapeOf(entryState())}; identical`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same diff", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the diff passed a candidate that does nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: scratch registers, the stack pointer and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  startNextRound(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: every captured dispatch replays identically, from the FIRST bracket", { skip }, () => {
  const { entries, shapes } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(startNextRound, captured), null, "a captured dispatch diverged");
    assert.ok(
      captured.mem8[ROUND_NUMBER] + 1 < SECOND_BRACKET_FROM,
      "a real dispatch now reaches a later difficulty bracket, so the sweep covers a different hole",
    );
  }
  console.log(`  CORPUS: ${entries.length} dispatches at round/era ${[...shapes].join(" ")}`);
});

test("EXHAUSTIVE ROUND: all 256 round-counter values pick the same cell", { skip }, () => {
  for (const v of BYTES) {
    const d = unitDiff(startNextRound, withRound(v));
    assert.equal(d, null, `round ${v}: ${show(d)}`);
  }
  console.log(`  EXHAUSTIVE ROUND: ${BYTES.length} values identical`);
});

test("EXHAUSTIVE ERA: all 256 era values roll the same way", { skip }, () => {
  for (const v of BYTES) {
    const d = unitDiff(startNextRound, withEra(v));
    assert.equal(d, null, `era ${v}: ${show(d)}`);
  }
  console.log(`  EXHAUSTIVE ERA: ${BYTES.length} values identical`);
});

test("THE ERA WRAPS AT FIVE: the era after each of six values is asserted", { skip }, () => {
  const after = [0, 1, 2, 3, 4, 5].map((era) => {
    const m = withEra(era);
    startNextRound(m);
    return m.mem8[ERA_INDEX];
  });
  assert.deepEqual(after, [1, 2, 3, 4, 0, 0], "the era no longer rolls forward and back to the first");
  console.log(`  WRAP: eras 0..5 become ${after.join(",")}`);
});

test("WHOLE-MACHINE: the poked session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(startNextRound);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, startNextRound]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, swept, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), swept, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: caught on ${swept} of ${SWEEP_SIZE} crafted entries`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const seen = caught(twin, entryState());
    assert.equal(seen, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${seen ? "catches it" : "is BLIND, as recorded"}`);
  });
}
