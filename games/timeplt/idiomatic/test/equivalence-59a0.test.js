// SPDX-License-Identifier: GPL-3.0-only
/**
 * doubledVelocityForHeading — memory-equivalent to the frozen oracle at ROM 0x59A0.
 *
 * WHAT IT IS. A velocity lookup that takes its heading as a VALUE rather than reading it off an
 * object, and doubles both halves of the answer before handing them back. It writes no memory at
 * all, so RAM cannot gate it and the declared live-out {b, c, d, e} is the contract; the BLIND arm
 * proves the first half of that claim rather than asserting it.
 *
 * ★ THE REWRITE REUSES velocityForHeading AND THAT IS AN IDENTITY, NOT AN APPROXIMATION. The
 *   doubling is the only thing this entry adds, so the DOUBLING arm sweeps every heading against
 *   every one of the three tables its callers select and checks the pair really is twice the
 *   undoubled lookup's, wrapping at sixteen bits rather than saturating — and the not-doubled twin
 *   is the tooth that says the arm can fail.
 *
 * ★ ITS THREE CALLERS EACH FIX A DIFFERENT TABLE, and no tape can vary which. So the crafted sweep
 *   runs all three, and the twins hand it the OTHER two plus three pointers that are no table.
 *
 * GATE: strict unit-capture, three replayed sessions at every dispatch, an exhaustive sweep of
 *   256 headings x 3 tables, and a whole-machine replay. What it exercises, holes stated:
 *
 *   1. CONTRACT — unitEquivalence at the first real dispatch: RAM identical. `equal` is not
 *      asserted; it folds in the register diff this contract deliberately drops.
 *   2. BLIND — that same call passes a no-op, which is what makes the pair the gate.
 *   3. UNIFORM CORPUS — what the sessions actually present: how many distinct headings, and which
 *      of the three tables. Asserted as counts.
 *   4. CORPUS — every dispatch of three sessions, on RAM plus the pair.
 *   5. EXCLUDED — over the whole sweep the registers that move are exactly the scratch set, and
 *      the object and sprite bases never move.
 *   6. EXHAUSTIVE — 256 headings against each of the three tables.
 *   7. DOUBLING — the pair against an independent undoubled lookup, over the same space.
 *   8. WHOLE-MACHINE — a driven session with the rewrite wired, diffed every frame.
 *   9. TEETH — ten twins, each declaring the headings it survives, its per-session catch counts,
 *      and whether the whole machine forks.
 *
 * HOLE: the heading arrives in a register, so the crafted sweep covers the whole input space of
 * that half exactly. The TABLE is the half no tape varies, and the sweep covers only the three
 * tables this entry's own callers select — not the other three rungs of the ladder.
 * HOLE: ONE record base per session. Nothing here reads the object, so that is not a gap in what
 * is exercised, only in what the corpus could have varied.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-59a0.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { doubledVelocityForHeading } from "../doubledVelocityForHeading.js";
import { velocityForHeading } from "../velocityForHeading.js";
import { loc_59a0 as oracle } from "../../translated/loc_59a0.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x59a0;

/** The three tables this entry's own callers select. */
const CALLER_TABLES = [0x59d7, 0x5c00, 0x5e00];

const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

const LIVE_OUT = ["b", "c", "d", "e"];
const MOVED = ["a", "f", "h", "l", "sp"];
const HELD = ["ix", "iy"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 1600;
const RET_TSTATES = 10;

const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const everyHeading = Array.from({ length: HEADINGS }, (_unused, h) => h);

/**
 * Survivor sets, measured, as `<table>:<heading>` in sweep order. A twin that changes only the
 * SECOND half of the pair cannot be seen where that half is zero, which is the two cardinal
 * headings; one that mirrors the partner cannot be seen where the partner is its own mirror.
 */
const tableEach = (headings) =>
  CALLER_TABLES.flatMap((t) => headings.map((h) => `${hex4(t)}:${h}`));
const CARDINAL_SURVIVORS = tableEach([0, 255]);
const MIRROR_SURVIVORS = tableEach([0, 127, 128, 255]);
const HALF_DOUBLED_SURVIVORS = tableEach([0, 127, 128, 131, 255]);
const OFF_BY_ONE_SURVIVORS = tableEach([127, 191]);
const DOUBLE_CARRY_SURVIVORS = [];

function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: 0x10, dur: CORPUS_FRAMES },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
  let frame = TURN_FIRST_FRAME;
  for (const bits of compass) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const sharedMachine = (overrides) => makeMachine(overrides);
const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

const SESSIONS = [
  ["shared", sharedMachine],
  ["attract", attractMachine],
  ["turning", turningMachine],
];

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 80, attract: 121, turning: 110 };
const DISTINCT_HEADINGS = { shared: 4, attract: 90, turning: 16 };

const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    sharedMachine,
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
  if (entry === null) gate(doubledVelocityForHeading);
  return entry;
}

/** Oracle vs candidate on clones of one machine: RAM first, then the declared pair. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  for (const k of LIVE_OUT) {
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/** The real captured machine with the two register inputs forced. */
function selector(heading, table) {
  const m = entryState().clone();
  m.regs.a = heading;
  m.regs.hl = table;
  return m;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(factory, candidate) {
  let dispatches = 0;
  let caught = 0;
  const headings = new Set();
  const tables = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      headings.add(mm.regs.a);
      tables.add(mm.regs.hl);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, headings, tables };
}

let sessionCache = null;
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...replaySession(factory, doubledVelocityForHeading) }));
  return sessionCache;
}

// ── the cycle shim ──────────────────────────────────────────────────────────────────────

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
  wholeMachineEquivalence(sharedMachine, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

function brokenNoOp() {}

/** BUG: forgets the doubling, so everything moves at half the pace. */
function brokenNotDoubled(m) {
  velocityForHeading(m, m.regs.hl, m.regs.a);
}

/** BUG: doubles only the first half of the pair. */
function brokenHalfDoubled(m) {
  const { regs } = m;
  velocityForHeading(m, regs.hl, regs.a);
  regs.de = (2 * regs.de) & 0xffff;
}

/** BUG: doubles each half's low byte on its own, so the carry into the high byte is lost. */
function brokenDoubleLosesCarry(m) {
  const { regs } = m;
  velocityForHeading(m, regs.hl, regs.a);
  const twice = (v) => (((v & 0xff00) | ((2 * v) & 0xff)) & 0xffff);
  regs.de = twice(regs.de);
  regs.bc = twice(regs.bc);
}

/** BUG: reads the heading off the object record, the way its sibling entry does. */
function brokenHeadingFromRecord(m) {
  const { regs } = m;
  velocityForHeading(m, regs.hl);
  regs.de = (2 * regs.de) & 0xffff;
  regs.bc = (2 * regs.bc) & 0xffff;
}

/** BUG: the partner is taken a quarter turn the OTHER way, which mirrors one axis. */
function brokenQuarterReversed(m) {
  const { regs } = m;
  const table = regs.hl;
  const heading = regs.a;
  regs.de = (2 * sampleAt(m, table, heading)) & 0xffff;
  regs.bc = (2 * sampleAt(m, table, heading + QUARTER)) & 0xffff;
}

/** BUG: the two halves of the answer change places. */
function brokenPairSwapped(m) {
  const { regs } = m;
  const table = regs.hl;
  const heading = regs.a;
  regs.de = (2 * sampleAt(m, table, heading - QUARTER)) & 0xffff;
  regs.bc = (2 * sampleAt(m, table, heading)) & 0xffff;
}

/** BUG: the pointer is off by a single entry, so every heading reads its neighbour. */
function brokenOffByOneEntry(m) {
  const { regs } = m;
  velocityForHeading(m, regs.hl + 2, regs.a);
  regs.de = (2 * regs.de) & 0xffff;
  regs.bc = (2 * regs.bc) & 0xffff;
}

/** BUG: the pointer is off by one BYTE, so each sample straddles two entries. */
function brokenMisaligned(m) {
  const { regs } = m;
  velocityForHeading(m, regs.hl + 1, regs.a);
  regs.de = (2 * regs.de) & 0xffff;
  regs.bc = (2 * regs.bc) & 0xffff;
}

/** BUG: ignores the heading the caller handed in and always answers for the first sample. */
function brokenHeadingIgnored(m) {
  const { regs } = m;
  velocityForHeading(m, regs.hl, 0);
  regs.de = (2 * regs.de) & 0xffff;
  regs.bc = (2 * regs.bc) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp, [], [80, 121, 110], true],
  ["not-doubled", brokenNotDoubled, [], [80, 121, 110], true],
  ["half-doubled", brokenHalfDoubled, HALF_DOUBLED_SURVIVORS, [40, 113, 68], true],
  ["double-loses-carry", brokenDoubleLosesCarry, DOUBLE_CARRY_SURVIVORS, [80, 121, 110], true],
  ["heading-from-record", brokenHeadingFromRecord, CARDINAL_SURVIVORS, [80, 116, 104], true],
  ["quarter-reversed", brokenQuarterReversed, MIRROR_SURVIVORS, [40, 113, 68], true],
  ["pair-swapped", brokenPairSwapped, [], [80, 121, 110], true],
  ["off-by-one-entry", brokenOffByOneEntry, OFF_BY_ONE_SURVIVORS, [79, 117, 110], true],
  ["misaligned-by-a-byte", brokenMisaligned, [], [80, 121, 110], true],
  ["heading-ignored", brokenHeadingIgnored, CARDINAL_SURVIVORS, [80, 116, 104], true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: unitEquivalence at the first real dispatch, RAM identical", { skip }, () => {
  const r = gate(doubledVelocityForHeading);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(`  CONTRACT: entry heading ${e.regs.a} table ${hex4(e.regs.hl)}; RAM identical`);
});

test("BLIND: RAM alone passes a no-op, which is why the pair is gated too", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenNoOp(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, "RAM caught a candidate that does nothing, so this routine DOES write " +
    "memory and every arm leaning on the declared pair has to be re-derived");
  assert.notEqual(unitDiff(brokenNoOp, entryState()), null, "the pair must catch the no-op");
  console.log("  BLIND: RAM sees nothing; the declared pair catches the empty candidate");
});

test("UNIFORM CORPUS: what real play presents at this entry", { skip }, () => {
  const seen = sessions();
  console.log(
    `  UNIFORM CORPUS (measured): ${seen.map((s) =>
      `${s.label} ${s.dispatches} dispatches / headings [${[...s.headings].join(",")}] / tables ` +
      `[${[...s.tables].map(hex4).join(",")}]`).join("; ")}`,
  );
  for (const s of seen) {
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} session never reached the routine`);
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.equal(s.headings.size, DISTINCT_HEADINGS[s.label], `the ${s.label} heading count moved`);
  }
  const tables = new Set(seen.flatMap((s) => [...s.tables]));
  for (const t of tables) {
    assert.ok(CALLER_TABLES.includes(t), `a caller now arrives with ${hex4(t)}, outside the three ` +
      "tables the crafted sweep covers");
  }
});

test("CORPUS: every dispatch of three real sessions replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  console.log(`  CORPUS: ${total} real dispatches, RAM and the pair identical on each`);
});

test("EXCLUDED, deliberately: only scratch registers move, over the whole sweep", { skip }, () => {
  const moved = new Set();
  for (const table of CALLER_TABLES) {
    for (const heading of everyHeading) {
      const a = selector(heading, table);
      const b = a.clone();
      oracle(a);
      doubledVelocityForHeading(b);
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
      for (const k of LIVE_OUT) assert.equal(a.regs[k], b.regs[k], `live-out ${k} at ${heading}`);
    }
  }
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")}`);
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k)), MOVED, "the excluded set changed shape");
  for (const k of HELD) assert.ok(!moved.has(k), `a base register moved (${k})`);
});

test("EXHAUSTIVE: 256 headings against each of the three tables are identical", { skip }, () => {
  let swept = 0;
  for (const table of CALLER_TABLES) {
    for (const heading of everyHeading) {
      const d = unitDiff(doubledVelocityForHeading, selector(heading, table));
      assert.equal(d, null, `table ${hex4(table)} heading ${heading}: ${show(d)}`);
      swept++;
    }
  }
  assert.equal(swept, CALLER_TABLES.length * HEADINGS, "the sweep shrank");
  console.log(`  EXHAUSTIVE: ${swept} table x heading comparisons identical`);
});

test("DOUBLING: the pair really is twice the undoubled lookup, wrapping not clamping", { skip }, () => {
  let wrapped = 0;
  for (const table of CALLER_TABLES) {
    for (const heading of everyHeading) {
      const m = selector(heading, table);
      const after = m.clone();
      oracle(after);
      const first = sampleAt(m, table, heading);
      const second = sampleAt(m, table, heading - QUARTER);
      assert.equal(after.regs.de, (2 * first) & 0xffff, `table ${hex4(table)} heading ${heading}`);
      assert.equal(after.regs.bc, (2 * second) & 0xffff, `table ${hex4(table)} heading ${heading}`);
      if (2 * first > 0xffff || 2 * second > 0xffff) wrapped++;
    }
  }
  console.log(`  DOUBLING (measured): ${wrapped} of ${CALLER_TABLES.length * HEADINGS} wrap`);
  assert.ok(wrapped > 0, "no sample in any of the three tables doubles past sixteen bits, so " +
    "nothing here separates a wrapping double from a widening one");
});

test("WHOLE-MACHINE: a driven session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(doubledVelocityForHeading);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches, identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, survives, perSession, wholeRunSees] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared headings`, { skip }, () => {
    const missed = [];
    for (const table of CALLER_TABLES) {
      for (const heading of everyHeading) {
        if (unitDiff(twin, selector(heading, table)) === null) missed.push(`${hex4(table)}:${heading}`);
      }
    }
    console.log(
      `  TEETH/${label}: caught on ${CALLER_TABLES.length * HEADINGS - missed.length} of ` +
        `${CALLER_TABLES.length * HEADINGS}; survivors [${missed.join(",")}]`,
    );
    assert.deepEqual(missed, survives, `${label}: wrong survivor set over the sweep`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = SESSIONS.map(([, factory]) => replaySession(factory, twin));
    console.log(`  TEETH/${label}: real sessions catch ${counts.map((r) => r.caught).join("/")}`);
    for (const [i, r] of counts.entries()) {
      assert.equal(r.caught, perSession[i], `the ${label} twin's ${SESSIONS[i][0]} count moved`);
    }
  });

  test(`TEETH: the whole machine sees the ${label} twin, or is recorded blind`, { skip }, () => {
    const w = replay(twin);
    console.log(
      `  TEETH/${label}: whole machine ${w.equal ? "is BLIND, as recorded" : `forks at frame ${w.frame}`}`,
    );
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.equal, !wholeRunSees, `the whole-machine verdict on the ${label} twin changed`);
  });
}
