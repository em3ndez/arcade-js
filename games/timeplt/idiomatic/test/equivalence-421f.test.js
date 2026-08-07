// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerTowardAimAtFixedRate — memory-equivalent to the frozen oracle at ROM 0x421F.
 *
 * ★ REACHED BY A POKE, AND THE CONTROL SAYS SO. Its caller is the last arm of a table indexed by
 *   the era cell, and no run this harness can drive gets there. The gate pokes that one cell and
 *   lets the game dispatch the routine itself with everything else coherent; an arm asserts the
 *   unpoked run reaches it zero times.
 *
 * GATE: poked-natural dispatch, every captured dispatch replayed, an exhaustive cross of the whole
 *   heading circle against the four phases of the frame counter, a whole-machine replay, and teeth.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included.
 *   2. VACUITY, MEASURED — a no-op is invisible at MOST real dispatches, because most of them
 *      either fall on the idle phase or arrive already pointing the right way. The exact count is
 *      asserted; the crafted cross is where the turning is actually gated.
 *   3. EXCLUDED, deliberately, pinned to an exact set.
 *   4. CORPUS — every dispatch the poked run produces.
 *   5. EXHAUSTIVE — 256 aim headings against a spread of current headings and all four phases,
 *      which covers the wrap, the dead band and both turn directions.
 *   6. IT TURNS THE SHORT WAY, WITH ONE EXCEPTION — for every gap round the circle the direction
 *      is compared against the shorter arc, and the arm asserts the EXACT set of gaps that take
 *      the longer one. That set is not empty: the direction test is taken on the gap plus one.
 *   7. THE DEAD BAND IS EXACTLY TWO — the gaps at which nothing moves are enumerated.
 *   8. THE IDLE PHASE IS ONE IN FOUR — the phases at which nothing moves are enumerated.
 *   9. WHOLE-MACHINE — the poked session replayed with the rewrite wired through a measured shim.
 *  10. TEETH — a twin per mechanism this gate claims, each caught on an exact declared count.
 *
 * HOLE: poking the era changes what the game does from that frame on. The dispatch is genuine and
 *   the machine coherent, but this is NOT evidence about which era really runs it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-421f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { steerTowardAimAtFixedRate } from "../steerTowardAimAtFixedRate.js";
import { loc_421f as oracle } from "../../translated/loc_421f.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { ERA_INDEX, FRAME_TICK } from "../names.js";

const TARGET = 0x421f;

const IDLE_PHASE = 3;
const AIM_HEADING = 1;
const CURRENT_HEADING = 2;
const STEP = 2;

const POKED_ERA = 4;
const POKE_FROM_FRAME = 1200;

const MOVED = ["f", "sp"];
const FRAMES = 2600;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 149;
const NO_OP_SEEN = 24;

const AIMS = Array.from({ length: 256 }, (_unused, h) => h);
const CURRENTS = [0, 1, 0x40, 0x7f, 0x80, 0xc0, 0xfe, 0xff];
const PHASES = [0, 1, 2, 3];
const SWEEP_SIZE = AIMS.length * CURRENTS.length * PHASES.length;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function factory(overrides, poked = true) {
  const m = makeMachine(overrides, { tape: [] });
  if (poked) m.pokes = [{ addr: ERA_INDEX, val: POKED_ERA, frame: POKE_FROM_FRAME, dur: null }];
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
  if (entry === null) gate(steerTowardAimAtFixedRate);
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
const shapeOf = (m) =>
  `${m.mem8[FRAME_TICK] & IDLE_PHASE}/` +
  `${(m.mem8[m.regs.ix + AIM_HEADING] - m.mem8[m.regs.ix + CURRENT_HEADING]) & 0xff}`;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const shapes = new Set();
  let noOpSeen = 0;
  const m = factory(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    shapes.add(shapeOf(mm));
    if (caught(() => {}, mm)) noOpSeen++;
    return oracle(mm);
  }]]));
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "corpus run ran short");
  corpus = { entries, shapes, noOpSeen };
  return corpus;
}

/** A real captured machine forced onto one (aim, current, phase). */
function craft(aim, current, phase) {
  const m = entryState().clone();
  m.mem8[m.regs.ix + AIM_HEADING] = aim;
  m.mem8[m.regs.ix + CURRENT_HEADING] = current;
  m.mem8[FRAME_TICK] = (m.mem8[FRAME_TICK] & ~IDLE_PHASE) | phase;
  return m;
}

function sweepCaught(candidate) {
  let n = 0;
  for (const a of AIMS) {
    for (const c of CURRENTS) for (const p of PHASES) if (caught(candidate, craft(a, c, p))) n++;
  }
  return n;
}

/** Where the heading ends up after the rewrite runs, for one crafted entry. */
function turnedTo(aim, current, phase) {
  const m = craft(aim, current, phase);
  steerTowardAimAtFixedRate(m);
  return m.mem8[m.regs.ix + CURRENT_HEADING];
}

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

const gapOf = (m) => (m.mem8[m.regs.ix + AIM_HEADING] - m.mem8[m.regs.ix + CURRENT_HEADING] + 1) & 0xff;
const idle = (m) => (m.mem8[FRAME_TICK] & IDLE_PHASE) === 0;

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: turns on every frame, so the object comes round four times as fast. */
function brokenNoIdlePhase(m) {
  const gap = gapOf(m);
  if (gap < 2) return;
  const current = m.mem8[m.regs.ix + CURRENT_HEADING];
  m.mem8[m.regs.ix + CURRENT_HEADING] = gap < 0x80 ? current + STEP : current - STEP;
}

/** BUG: turns on the idle frame only, so it comes round four times as slowly. */
function brokenIdlePhaseInverted(m) {
  if (!idle(m)) return;
  const gap = gapOf(m);
  if (gap < 2) return;
  const current = m.mem8[m.regs.ix + CURRENT_HEADING];
  m.mem8[m.regs.ix + CURRENT_HEADING] = gap < 0x80 ? current + STEP : current - STEP;
}

/** BUG: always the long way round, so it chases the aim across the whole circle. */
function brokenAlwaysTheLongWay(m) {
  if (idle(m)) return;
  const gap = gapOf(m);
  if (gap < 2) return;
  const current = m.mem8[m.regs.ix + CURRENT_HEADING];
  m.mem8[m.regs.ix + CURRENT_HEADING] = gap < 0x80 ? current - STEP : current + STEP;
}

/** BUG: no dead band, so it steps past the aim and back forever. */
function brokenNoDeadBand(m) {
  if (idle(m)) return;
  const gap = gapOf(m);
  const current = m.mem8[m.regs.ix + CURRENT_HEADING];
  m.mem8[m.regs.ix + CURRENT_HEADING] = gap < 0x80 ? current + STEP : current - STEP;
}

/** BUG: steps one unit rather than two, halving the turn rate. */
function brokenStepOfOne(m) {
  if (idle(m)) return;
  const gap = gapOf(m);
  if (gap < 2) return;
  const current = m.mem8[m.regs.ix + CURRENT_HEADING];
  m.mem8[m.regs.ix + CURRENT_HEADING] = gap < 0x80 ? current + 1 : current - 1;
}

/** BUG: the aim moves instead of the current heading, so the object never turns. */
function brokenMovesTheAim(m) {
  if (idle(m)) return;
  const gap = gapOf(m);
  if (gap < 2) return;
  const aim = m.mem8[m.regs.ix + AIM_HEADING];
  m.mem8[m.regs.ix + AIM_HEADING] = gap < 0x80 ? aim - STEP : aim + STEP;
}

/** Per twin: exact catch count over the crafted cross, and its verdict at the real dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 6096, false],
  ["no-idle-phase", brokenNoIdlePhase, 2032, false],
  ["idle-phase-inverted", brokenIdlePhaseInverted, 8128, false],
  ["always-the-long-way", brokenAlwaysTheLongWay, 6096, false],
  ["no-dead-band", brokenNoDeadBand, 48, true],
  ["step-of-one", brokenStepOfOne, 6096, false],
  ["moves-the-aim", brokenMovesTheAim, 6096, false],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("NEGATIVE CONTROL: without the poke the game never dispatches it", { skip }, () => {
  assert.throws(
    () => unitEquivalence((o) => factory(o, false), TARGET, oracle, steerTowardAimAtFixedRate, { maxFrames: FRAMES }),
    /never entered/,
    "an unpoked run reached this arm, so the poke is not what makes it reachable",
  );
  console.log("  CONTROL: zero dispatches in an unpoked run of the same length");
});

test("EQUAL at the real dispatch: steerTowardAimAtFixedRate == oracle on the whole dump", { skip }, () => {
  const r = gate(steerTowardAimAtFixedRate);
  assert.notEqual(entry, null, "vacuous: the poked run never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry phase/gap ${shapeOf(entryState())}; identical`);
});

test("VACUITY, MEASURED: a no-op is invisible at most real dispatches", { skip }, () => {
  const { entries, noOpSeen } = captureCorpus();
  assert.equal(noOpSeen, NO_OP_SEEN, "the fraction of dispatches a no-op is visible at moved");
  assert.ok(noOpSeen > 0, "a no-op is invisible at EVERY real dispatch, so RAM gates nothing here");
  assert.ok(noOpSeen < entries.length, "a no-op is now visible everywhere, so the hole has closed");
  console.log(`  VACUITY: a no-op shows at ${noOpSeen} of ${entries.length} real dispatches`);
});

test("EXCLUDED, deliberately: the flag byte, the stack pointer and pc", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  steerTowardAimAtFixedRate(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, shapes } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  for (const captured of entries) {
    assert.equal(unitDiff(steerTowardAimAtFixedRate, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches over ${shapes.size} phase/gap shapes`);
});

test("EXHAUSTIVE: every aim against a spread of headings and all four phases", { skip }, () => {
  for (const a of AIMS) {
    for (const c of CURRENTS) {
      for (const p of PHASES) {
        const d = unitDiff(steerTowardAimAtFixedRate, craft(a, c, p));
        assert.equal(d, null, `aim ${a} current ${c} phase ${p}: ${show(d)}`);
      }
    }
  }
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} combinations identical`);
});

test("IT TURNS THE SHORT WAY, WITH ONE EXCEPTION, and the exception is exact", { skip }, () => {
  const current = 0x40;
  const longWay = [];
  for (const aim of AIMS) {
    const gap = (aim - current) & 0xff;
    if (gap === 0 || gap === 255) continue; // the dead band, enumerated by the arm below
    const after = turnedTo(aim, current, 1);
    const moved = ((after - current) & 0xff) === STEP ? +1 : -1;
    const shorter = gap < 0x80 ? +1 : -1;
    if (moved !== shorter) longWay.push(gap);
  }
  assert.deepEqual(
    longWay,
    [127],
    "the set of gaps where the turn takes the LONGER way round moved. It is not empty and is not " +
      "meant to be: the direction test is taken on the gap plus one, which tips exactly the gap " +
      "one short of a half turn onto the wrong side",
  );
  console.log(`  SHORT WAY: every gap but ${longWay.join(",")} turns toward the nearer side`);
});

test("THE DEAD BAND IS EXACTLY TWO GAPS WIDE", { skip }, () => {
  const current = 0x40;
  const still = AIMS.filter((aim) => turnedTo(aim, current, 1) === current);
  assert.deepEqual(
    still.map((aim) => (aim - current) & 0xff).sort((x, y) => x - y),
    [0, 255],
    "the set of gaps at which the heading stands still moved",
  );
  console.log(`  DEAD BAND: still at gaps 0 and 255 (the aim, and one step short of it)`);
});

test("THE IDLE PHASE IS ONE IN FOUR", { skip }, () => {
  const idlePhases = PHASES.filter((p) => turnedTo(0xc0, 0x40, p) === 0x40);
  assert.deepEqual(idlePhases, [0], "the set of counter phases that do nothing moved");
  console.log(`  IDLE: the heading stands still on phase ${idlePhases.join(",")} of four`);
});

test("WHOLE-MACHINE: the poked session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(steerTowardAimAtFixedRate);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, steerTowardAimAtFixedRate]]));
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
