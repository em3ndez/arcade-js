// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerTowardAimHeading — memory-equivalent to the frozen oracle at ROM 0x2BEF.
 *
 * GATE: the required strict unit-capture is VACUOUS, and the BLIND arm PROVES that rather than
 *   asserting it. unitEquivalence clones the FIRST dispatch, and at that dispatch the object's two
 *   heading bytes are BOTH ZERO — dead (the frozen routine takes the arm that writes nothing) and
 *   degenerate (zero over zero) at the same time — so `ram === null` holds for the rewrite, for
 *   every broken twin and for a bare no-op alike. A larger maxFrames cannot fix it: the entry
 *   cloned is the first one, not the first informative one. The real gates are below.
 *
 * What it exercises:
 *   1. BLIND — a no-op passes the required unit gate. Asserted, with the degenerate entry pinned,
 *      so the day the first dispatch becomes informative this file is forced to be re-derived.
 *   2. EXHAUSTIVE — the whole two-cell input space, 65536 pairs at the real entry, compared over
 *      the object's whole record rather than only the one byte that should move.
 *   3. RATE, CRAFTED — the step size is fetched through a global cell that natural play never
 *      moved off zero, where the fetch happens to yield one. Every value of that cell is swept on
 *      a real entry nudged into each turning direction. This is why a twin that ignores the table
 *      and always steps by one does not survive: no corpus of natural dispatches can see it.
 *   4. CORPUS — every real dispatch of a driven run: candidate on a clone taken at the dispatch,
 *      frozen routine on the live machine it came from, whole state dump compared. The permitted
 *      difference is PINNED, not excluded — empty, or exactly the two bytes below the entry stack
 *      pointer that the frozen routine's own call bracketing leaves behind.
 *   5. LIVE-OUT — the whole session run again with every register the rewrite does not reproduce
 *      OVERWRITTEN, at every dispatch, by what the rewrite leaves in it. The state trace stays
 *      byte-identical, so they are all dead; a probe arm shows the same method sees a live
 *      register when there is one, so the negative result is not vacuous either.
 *   6. TEETH — twins aimed at writing nothing, at the window, at the direction, at the cell
 *      written and at the rate table, each caught by an arm the rewrite passes.
 *
 * HOLE: the stack pointer is outside the live-out arm and has to be. The frozen routine pops the
 * return address a register-passing caller pushed and the rewrite, modelling no stack, does not;
 * handing the game the rewrite's stack pointer would break the caller rather than measure it.
 * HOLE: both sweeps vary cells at ONE captured object base. The corpus covers the other bases.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2bef.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { steerTowardAimHeading } from "../steerTowardAimHeading.js";
import { loc_2bef as oracle } from "../../translated/loc_2bef.js";
import { unitEquivalence, wholeMachineEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x2bef;
const CORPUS_FRAMES = 2600;
const AIM = 1;
const HEADING = 2;
const HALF_TURN = 128;
const RATE_CELL = 0xad04;
const RECORD_BYTES = 8;
const SCRATCH_BYTES = 2;
const DROPPED = ["a", "b", "c", "f"];
const skip = romsPresent() ? false : "ROM images are not assembled";

/** Re-derived here on purpose, so the test states the window instead of importing it. */
const arrived = (away) => u8(away + 2) < 4;
const armOf = (away) => (arrived(away) ? "arrived" : away < HALF_TURN ? "forward" : "back");

let entry = null;

/** unitEquivalence with the pristine entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(steerTowardAimHeading);
  return entry;
}

const awayIn = (m, object) => u8(m.mem8[u16(object + AIM)] - m.mem8[u16(object + HEADING)]);
const record = (m, object) => {
  const out = [];
  for (let i = 0; i < RECORD_BYTES; i++) out.push(m.mem8[u16(object + i)]);
  return out.join(",");
};

const moved = (set) => REG_FIELDS.filter((k) => set.has(k));

/** Every address whose byte differs between two state dumps. */
function diffAddrs(a, b, toAddr) {
  const out = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) out.push(toAddr(i));
  return out;
}

/** Both headings swept over their entire joint range, on the captured entry. */
function sweep(candidate) {
  const object = entryState().regs.ix;
  const aimCell = u16(object + AIM);
  const headingCell = u16(object + HEADING);
  const a = entryState().clone();
  const b = entryState().clone();
  const pristine = entryState().clone().regs;
  const arms = { arrived: 0, forward: 0, back: 0 };
  let caught = 0;
  for (let heading = 0; heading < 256; heading++) {
    for (let aim = 0; aim < 256; aim++) {
      a.regs.copyFrom(pristine);
      b.regs.copyFrom(pristine);
      a.mem8[aimCell] = aim;
      a.mem8[headingCell] = heading;
      b.mem8[aimCell] = aim;
      b.mem8[headingCell] = heading;
      oracle(a);
      candidate(b);
      if (record(a, object) !== record(b, object)) caught++;
      arms[armOf(u8(aim - heading))]++;
    }
  }
  return { caught, arms, total: 256 * 256 };
}

/**
 * The rate cell swept over every value the table fetch can be handed, on a real entry nudged
 * into one turning direction. Natural play never varies this cell, so nothing else can cover it.
 */
function rateSweep(candidate, aim, heading) {
  const object = entryState().regs.ix;
  const aimCell = u16(object + AIM);
  const headingCell = u16(object + HEADING);
  const a = entryState().clone();
  const b = entryState().clone();
  const pristine = entryState().clone().regs;
  const steps = new Set();
  let caught = 0;
  for (let index = 0; index < 256; index++) {
    for (const side of [a, b]) {
      side.regs.copyFrom(pristine);
      side.mem8[aimCell] = aim;
      side.mem8[headingCell] = heading;
      side.mem8[RATE_CELL] = index;
    }
    oracle(a);
    candidate(b);
    if (record(a, object) !== record(b, object)) caught++;
    steps.add(u8(a.mem8[headingCell] - heading));
  }
  return { caught, steps, total: 256 };
}

/** Replay every real dispatch of a driven run; the frozen routine stays on the live machine. */
function corpus(candidate) {
  const arms = { arrived: 0, forward: 0, back: 0 };
  const scratchOffsets = new Set();
  const scratchArms = new Set();
  const foreign = new Set();
  const movedRegs = { arrived: new Set(), turning: new Set() };
  const rates = new Set();
  let dispatches = 0;
  let disagreed = 0;
  const host = makeMachine(
    new Map([
      [
        TARGET,
        (m) => {
          const b = m.clone();
          const object = m.regs.ix;
          const sp = m.regs.sp;
          const arm = armOf(awayIn(m, object));
          rates.add(m.mem8[RATE_CELL]);
          candidate(b);
          const proceed = oracle(m);
          dispatches++;
          arms[arm]++;
          let bad = record(m, object) !== record(b, object);
          for (const addr of diffAddrs(m.dumpState(), b.dumpState(), (o) => m.stateOffsetToAddr(o))) {
            const below = u16(sp - addr);
            if (below >= 1 && below <= SCRATCH_BYTES) {
              scratchOffsets.add(below);
              scratchArms.add(arm);
            } else {
              foreign.add(addr);
              bad = true;
            }
          }
          if (bad) disagreed++;
          const set = arm === "arrived" ? movedRegs.arrived : movedRegs.turning;
          for (const k of REG_FIELDS) if (m.regs[k] !== b.regs[k]) set.add(k);
          return proceed;
        },
      ],
    ]),
  );
  const frames = host.runFrames(CORPUS_FRAMES);
  return {
    dispatches, disagreed, arms, rates: [...rates],
    scratchOffsets: [...scratchOffsets].sort(), scratchArms: [...scratchArms].sort(),
    foreign: [...foreign], movedRegs,
    frames: frames.length, stoppedBy: host.stoppedBy,
  };
}

/** A whole-session arm that stopped short searched nothing and must not read as a pass. */
function assertWholeRun(r) {
  assert.equal(r.stoppedBy, null, `the session stopped early: ${r.stoppedBy}`);
  assert.equal(r.frames, CORPUS_FRAMES, "the session did not run to its full length");
  assert.ok(r.dispatches > 0, "vacuous: the routine never dispatched");
}

/**
 * The frozen routine on the live machine, then every register the rewrite does NOT reproduce
 * overwritten with what the rewrite leaves in it. If the game plays on unchanged, they are dead.
 */
function poisonDropped(m) {
  const b = m.clone();
  steerTowardAimHeading(b);
  const out = oracle(m);
  for (const k of DROPPED) m.regs[k] = b.regs[k];
  return out;
}

/** Nudge one register the rewrite DOES reproduce, to show the same arm can see a live one. */
function probeLive(reg) {
  const poison = (m) => {
    const out = oracle(m);
    m.regs[reg] = u16(m.regs[reg] + 1);
    return out;
  };
  try {
    const r = wholeMachineEquivalence(makeMachine, CORPUS_FRAMES, new Map([[TARGET, poison]]));
    return r.equal ? "identical" : "diverged";
  } catch (e) {
    return `faulted: ${String(e).slice(0, 48)}`;
  }
}

// ── the arms ────────────────────────────────────────────────────────────────────────────────

test("BLIND: the required unit gate is a TAUTOLOGY here — a no-op passes it", { skip }, () => {
  const r = gate(() => {});
  assert.equal(r.ram, null, "a no-op DIVERGED, so the first dispatch is no longer the dead one");
  const object = entryState().regs.ix;
  const away = awayIn(entryState(), object);
  assert.equal(entryState().mem8[u16(object + AIM)], entryState().mem8[u16(object + HEADING)]);
  assert.equal(away, 0, "the captured entry is zero over zero — degenerate as well as dead");
  assert.equal(armOf(away), "arrived", "the frozen routine writes nothing at this entry");
  console.log(`  BLIND: entry is zero over zero, arm '${armOf(away)}' — RAM cannot be the gate`);
});

test("EQUAL at the real dispatch: the rewrite passes the same unit gate", { skip }, () => {
  const r = gate(steerTowardAimHeading);
  assert.equal(r.ram, null, "RAM diverged at the captured entry");
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  console.log(`  EQUAL: reached within ${ENTRY_FRAMES} frames; RAM identical — and meaningless`);
});

test("EXHAUSTIVE: all 65536 heading pairs leave the record identical", { skip }, () => {
  const r = sweep(steerTowardAimHeading);
  assert.equal(r.caught, 0, `${r.caught} of ${r.total} heading pairs disagreed`);
  assert.equal(r.arms.arrived, 4 * 256, "a four-wide window on every one of the 256 headings");
  assert.equal(r.arms.forward, 126 * 256, "the rest of the near half turn, per heading");
  assert.equal(r.arms.back, 126 * 256, "and its mirror the long way round");
  console.log(
    `  EXHAUSTIVE: ${r.total} pairs identical — ${r.arms.arrived} arrived, ` +
      `${r.arms.forward} forward, ${r.arms.back} back`,
  );
});

test("RATE, crafted: every value of the rate cell fetches the step the frozen routine does", { skip }, () => {
  const forward = rateSweep(steerTowardAimHeading, 160, 100);
  const back = rateSweep(steerTowardAimHeading, 40, 100);
  assert.equal(forward.caught, 0, "the forward direction disagreed on some rate");
  assert.equal(back.caught, 0, "the backward direction disagreed on some rate");
  assert.ok(
    forward.steps.size > 1,
    "vacuous: every rate produced the same step, so this arm distinguishes nothing",
  );
  console.log(
    `  RATE: ${forward.total} rates identical both ways, ` +
      `${forward.steps.size} distinct step sizes reached`,
  );
});

test("CORPUS: every real dispatch of a driven session agrees", { skip }, () => {
  const r = corpus(steerTowardAimHeading);
  assertWholeRun(r);
  assert.equal(r.disagreed, 0, `${r.disagreed} of ${r.dispatches} real dispatches disagreed`);
  assert.deepEqual(r.foreign, [], "a difference landed somewhere other than the stack scratch");
  assert.ok(r.arms.arrived > 0 && r.arms.forward > 0 && r.arms.back > 0, "an arm never ran");
  assert.deepEqual(r.scratchOffsets, [1, 2], "the scratch must be two bytes below the pointer");
  assert.deepEqual(
    r.scratchArms,
    ["back", "forward"],
    "only a turning dispatch may leave scratch: the arrived arm brackets no call",
  );
  assert.deepEqual(
    moved(r.movedRegs.arrived),
    moved(new Set(["a", "c", "f", "sp"])),
    "the arrived arm's excluded set changed shape",
  );
  assert.deepEqual(
    moved(r.movedRegs.turning),
    moved(new Set([...DROPPED, "sp"])),
    "the turning arm may differ in exactly the four dropped registers and the stack pointer",
  );
  console.log(
    `  CORPUS: ${r.dispatches} dispatches over ${r.frames} frames — ${r.arms.arrived} arrived, ` +
      `${r.arms.forward} forward, ${r.arms.back} back; rate cell held ${r.rates.join(", ")}`,
  );
});

test("LIVE-OUT: the registers the rewrite drops are dead at every dispatch", { skip }, () => {
  const r = wholeMachineEquivalence(makeMachine, CORPUS_FRAMES, new Map([[TARGET, poisonDropped]]));
  assert.equal(r.equal, true, `state drifted at frame ${r.frame}, address ${r.addr}`);
  assert.equal(r.framesCompared, CORPUS_FRAMES, "the session did not run to its full length");
  assert.ok(r.invocations.get(TARGET) > 0, "vacuous: the override never fired");
  console.log(
    `  LIVE-OUT: ${r.framesCompared} frames identical with ${DROPPED.join(", ")} overwritten ` +
      `at ${r.invocations.get(TARGET)} dispatches — memory is the only live-out`,
  );
});

test("LIVE-OUT is not vacuous: the same arm SEES a register that is live", { skip }, () => {
  const verdicts = ["ix", "iy"].map((reg) => [reg, probeLive(reg)]);
  for (const [reg, verdict] of verdicts) {
    assert.notEqual(
      verdict,
      "identical",
      `nudging ${reg} changed nothing, so the arm above cannot detect a live register at all`,
    );
  }
  console.log(`  LIVE-OUT probe: ${verdicts.map(([k, v]) => `${k} ${v}`).join("; ")}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// Different ways to get this routine wrong, not spellings of one. Each is caught by an arm the
// rewrite passes above, and the rate twin only by the arm no run of natural play could stand in
// for.

const TURN_RATE_TABLE = 0x2c1d;
const headingCellOf = (m, object) => u16(object + HEADING);
const stepFor = (m) => m.mem8[u16(TURN_RATE_TABLE + m.mem8[RATE_CELL])];

/** BUG: writes nothing — the tell that a gate is measuring an unreached routine. */
const brokenNoOp = () => {};

/** BUG: no window at all, so an object already on its aim jitters around it forever. */
const brokenAlwaysTurn = (m, object = m.regs.ix) => {
  const cell = headingCellOf(m, object);
  const heading = m.mem8[cell];
  const away = awayIn(m, object);
  m.mem8[cell] = away < HALF_TURN ? heading + stepFor(m) : heading - stepFor(m);
};

/** BUG: the window centred on zero instead of sitting one step off it. */
const brokenWindowShifted = (m, object = m.regs.ix) => {
  const cell = headingCellOf(m, object);
  const heading = m.mem8[cell];
  const away = awayIn(m, object);
  if (u8(away + 1) < 3) return;
  m.mem8[cell] = away < HALF_TURN ? heading + stepFor(m) : heading - stepFor(m);
};

/** BUG: always the long way round the circle. */
const brokenWrongWay = (m, object = m.regs.ix) => {
  const cell = headingCellOf(m, object);
  const heading = m.mem8[cell];
  const away = awayIn(m, object);
  if (arrived(away)) return;
  m.mem8[cell] = away < HALF_TURN ? heading - stepFor(m) : heading + stepFor(m);
};

/** BUG: turns the aim instead of the heading, so the object chases a moving target. */
const brokenWrongCell = (m, object = m.regs.ix) => {
  const cell = u16(object + AIM);
  const heading = m.mem8[u16(object + HEADING)];
  const away = awayIn(m, object);
  if (arrived(away)) return;
  m.mem8[cell] = away < HALF_TURN ? heading + stepFor(m) : heading - stepFor(m);
};

/** BUG: the table never consulted, one step every time. INVISIBLE to any natural dispatch. */
const brokenFixedStep = (m, object = m.regs.ix) => {
  const cell = headingCellOf(m, object);
  const heading = m.mem8[cell];
  const away = awayIn(m, object);
  if (arrived(away)) return;
  m.mem8[cell] = away < HALF_TURN ? heading + 1 : heading - 1;
};

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["always-turn", brokenAlwaysTurn],
  ["window-shifted", brokenWindowShifted],
  ["wrong-way", brokenWrongWay],
  ["wrong-cell", brokenWrongCell],
]) {
  test(`TEETH: the ${label} twin is CAUGHT by the exhaustive sweep`, { skip }, () => {
    const r = sweep(twin);
    assert.ok(r.caught > 0, `the sweep PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${r.total} heading pairs`);
  });
}

test("TEETH: the corpus of real dispatches catches the no-op twin at a real cell", { skip }, () => {
  const r = corpus(brokenNoOp);
  assertWholeRun(r);
  assert.ok(r.disagreed > 0, "the corpus PASSED a no-op — it is measuring nothing");
  assert.ok(r.foreign.length > 0, "the corpus caught it only in stack scratch, which is not a cell");
  console.log(
    `  TEETH/no-op: ${r.disagreed} of ${r.dispatches} dispatches disagreed, ` +
      `at ${r.foreign.length} distinct cells`,
  );
});

test("TEETH: the fixed-step twin survives natural play and only the RATE arm sees it", { skip }, () => {
  const natural = corpus(brokenFixedStep);
  assertWholeRun(natural);
  assert.equal(
    natural.disagreed,
    0,
    "natural play DID catch the fixed-step twin, so the crafted rate arm is redundant and " +
      "this file should say so instead of claiming the corpus is blind to it",
  );
  const crafted = rateSweep(brokenFixedStep, 160, 100);
  assert.ok(crafted.caught > 0, "the rate arm PASSED the fixed-step twin — nothing covers the table");
  console.log(
    `  TEETH/fixed-step: ${natural.dispatches} natural dispatches saw nothing; the rate arm ` +
      `catches it on ${crafted.caught} of ${crafted.total} rates`,
  );
});
