// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyAlongHeadingAtDoubleVelocity — memory-equivalent to the frozen oracle at ROM 0x58FE.
 *
 * GATE: strict unit-capture on the undriven attract run, every captured dispatch replayed, an
 *   exhaustive heading sweep over four speed tables, a crafted cross over the displacement cells
 *   and the four coordinate bytes, a whole-machine replay, and teeth. RAM IS A REAL GATE: the
 *   routine writes four bytes and the NOT VACUOUS arm proves a do-nothing candidate fails on RAM
 *   at the real dispatch.
 *   1. EQUAL at the real dispatch — the whole dump identical, stack scratch included.
 *   2. NOT VACUOUS — a no-op candidate fails the same diff.
 *   3. EXCLUDED, deliberately, pinned to an exact set.
 *   4. LATE FIRST DISPATCH — nothing reaches this inside the budget the other gates use, so the
 *      run here is several times longer; the arm asserts the frame the first dispatch arrives on
 *      is past that budget and inside this one.
 *   5. CORPUS — every dispatch the attract run produces, with the tables and headings it presented.
 *   6. EXHAUSTIVE — 256 headings on each of four speed tables.
 *   7. CRAFTED CROSS — both displacement cells and all four coordinate bytes forced identically on
 *      both arms, over displacements that carry, wrap and change sign.
 *   8. THE STEP IS DOUBLED — the distance moved is compared against the world displacement alone,
 *      and the difference asserted to be twice the table's own component rather than once. That is
 *      the whole of what separates this entry from its single-step neighbour, so it gets its own
 *      arm rather than resting on a twin.
 *   9. WHOLE-MACHINE — the session replayed with the rewrite wired through a measured shim.
 *  10. TEETH — eight twins, each caught on exact declared counts. The carry twin is INVISIBLE on
 *      the whole heading sweep and at the real dispatch, because both fractions are zero there;
 *      the crafted cross is the only arm that catches it, and the counts say so.
 *
 * HOLE: the attract run presents ONE speed table and ONE object slot, so the table selection and
 *   the slot bases are exercised only by crafting.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-58fe.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { flyAlongHeadingAtDoubleVelocity } from "../flyAlongHeadingAtDoubleVelocity.js";
import { loc_58fe as oracle } from "../../translated/loc_58fe.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";

const TARGET = 0x58fe;

const HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;
const WHOLE_FIRST = 49;
const FRACTION_FIRST = 3;
const WHOLE_SECOND = 0;
const FRACTION_SECOND = 5;

/** The speed tables the callers hand in; the attract run reaches only the first. */
const TABLES = [0x59d7, 0x5e00, 0x2e3e, 0x5c00];

const MOVED = ["a", "f", "d", "e", "h", "l", "sp"];
const FRAMES = 6000;
const RET_TSTATES = 10;

/** Measured over the corpus below; a move is a finding. */
const DISPATCHES = 391;
const FIRST_DISPATCH_BEFORE = 6000;
const SHARED_BUDGET = 1400;

const EVERY_HEADING = Array.from({ length: HEADINGS }, (_unused, h) => h);
const SCROLLS = [0x0000, 0x0001, 0x00ff, 0x0100, 0x0180, 0x7fff, 0x8000, 0xffff];
const POSITIONS = [
  { wA: 0, fA: 0, wB: 0, fB: 0 },
  { wA: 0, fA: 255, wB: 255, fB: 0 },
  { wA: 255, fA: 255, wB: 255, fB: 255 },
  { wA: 138, fA: 203, wB: 129, fB: 88 },
];

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const factory = (overrides) => makeMachine(overrides, { tape: [] });

const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];
const headingOf = (m) => m.mem8[m.regs.ix + HEADING_CELL];
const componentsOf = (m) => [
  sampleAt(m, m.regs.hl, headingOf(m)),
  sampleAt(m, m.regs.hl, headingOf(m) - QUARTER),
];

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(factory, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return candidate(m);
  }, { maxFrames: FRAMES });
}

function entryState() {
  if (entry === null) gate(flyAlongHeadingAtDoubleVelocity);
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
const shapeOf = (m) => `${hex4(m.regs.hl)}/${headingOf(m)}`;

// ── the corpus ──────────────────────────────────────────────────────────────────────────

let corpus = null;
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const tables = new Set();
  const headings = new Set();
  let firstFrame = null;
  const m = factory(new Map([[TARGET, (mm) => {
    if (firstFrame === null) firstFrame = mm.frames.length;
    entries.push(mm.clone());
    tables.add(mm.regs.hl);
    headings.add(headingOf(mm));
    return oracle(mm);
  }]]));
  const frames = m.runFrames(FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "corpus run ran short");
  corpus = { entries, tables, headings, firstFrame };
  return corpus;
}

function selector(table, heading) {
  const m = entryState().clone();
  m.regs.hl = table;
  m.mem8[m.regs.ix + HEADING_CELL] = heading;
  return m;
}

function craft(table, heading, dA, dB, p) {
  const m = selector(table, heading);
  m.mem16[WORLD_SCROLL_Y] = dA;
  m.mem16[WORLD_SCROLL_X] = dB;
  m.mem8[m.regs.iy + WHOLE_FIRST] = p.wA;
  m.mem8[m.regs.ix + FRACTION_FIRST] = p.fA;
  m.mem8[m.regs.iy + WHOLE_SECOND] = p.wB;
  m.mem8[m.regs.ix + FRACTION_SECOND] = p.fB;
  return m;
}

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  const selectors = [[TABLES[0], 0], [TABLES[1], QUARTER], [TABLES[2], 137], [TABLES[3], 255]];
  for (const [t, h] of selectors) {
    for (const dA of SCROLLS) for (const dB of SCROLLS) for (const p of POSITIONS) {
      out.push([t, h, dA, dB, p]);
    }
  }
  crossCache = out;
  return out;
}

const SWEEP_SIZE = TABLES.length * HEADINGS;
const sweepCaught = (candidate) => {
  let n = 0;
  for (const t of TABLES) for (const h of EVERY_HEADING) if (caught(candidate, selector(t, h))) n++;
  return n;
};
const crossCaught = (candidate) => cross().filter((c) => caught(candidate, craft(...c))).length;

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

function store(m, wholeAddr, fractionAddr, displacement) {
  const moved = (m.mem8[wholeAddr] << 8) + m.mem8[fractionAddr] + displacement;
  m.mem8[wholeAddr] = moved >> 8;
  m.mem8[fractionAddr] = moved;
}

const first = (m) => m.regs.iy + WHOLE_FIRST;
const firstFraction = (m) => m.regs.ix + FRACTION_FIRST;
const second = (m) => m.regs.iy + WHOLE_SECOND;
const secondFraction = (m) => m.regs.ix + FRACTION_SECOND;

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: a single step, which is what the neighbouring entry does. */
function brokenSingleStep(m) {
  const [a, b] = componentsOf(m);
  store(m, first(m), firstFraction(m), m.mem16[WORLD_SCROLL_Y] + a);
  store(m, second(m), secondFraction(m), m.mem16[WORLD_SCROLL_X] + b);
}

/** BUG: doubles the world displacement as well, so the camera runs at twice its pace. */
function brokenDoublesTheWorld(m) {
  const [a, b] = componentsOf(m);
  store(m, first(m), firstFraction(m), 2 * (m.mem16[WORLD_SCROLL_Y] + a));
  store(m, second(m), secondFraction(m), 2 * (m.mem16[WORLD_SCROLL_X] + b));
}

/** BUG: carries the object with the world and never flies it. */
function brokenScrollOnly(m) {
  store(m, first(m), firstFraction(m), m.mem16[WORLD_SCROLL_Y]);
  store(m, second(m), secondFraction(m), m.mem16[WORLD_SCROLL_X]);
}

/** BUG: flies but pins the object to the world instead of letting it stream past. */
function brokenHeadingOnly(m) {
  const [a, b] = componentsOf(m);
  store(m, first(m), firstFraction(m), 2 * a);
  store(m, second(m), secondFraction(m), 2 * b);
}

/** BUG: each coordinate gets the other's component, so the object flies sideways. */
function brokenAxesSwapped(m) {
  const [a, b] = componentsOf(m);
  store(m, first(m), firstFraction(m), m.mem16[WORLD_SCROLL_Y] + 2 * b);
  store(m, second(m), secondFraction(m), m.mem16[WORLD_SCROLL_X] + 2 * a);
}

/** BUG: adds each half of the displacement to its own byte, so a fraction never banks. */
function brokenNoCarry(m) {
  const [a, b] = componentsOf(m);
  const dA = (m.mem16[WORLD_SCROLL_Y] + 2 * a) & 0xffff;
  const dB = (m.mem16[WORLD_SCROLL_X] + 2 * b) & 0xffff;
  m.mem8[first(m)] = m.mem8[first(m)] + (dA >> 8);
  m.mem8[firstFraction(m)] = m.mem8[firstFraction(m)] + (dA & 0xff);
  m.mem8[second(m)] = m.mem8[second(m)] + (dB >> 8);
  m.mem8[secondFraction(m)] = m.mem8[secondFraction(m)] + (dB & 0xff);
}

/** BUG: moves the first coordinate and forgets the second one entirely. */
function brokenSecondSkipped(m) {
  const [a] = componentsOf(m);
  store(m, first(m), firstFraction(m), m.mem16[WORLD_SCROLL_Y] + 2 * a);
}

/** Per twin: catches over the heading sweep, over the crafted cross, and at the real dispatch. */
const TWINS = [
  ["no-op", brokenNoOp, 1024, 1024, true],
  ["single-step", brokenSingleStep, 1024, 1024, true],
  ["doubles-the-world", brokenDoublesTheWorld, 1024, 1008, true],
  ["scroll-only", brokenScrollOnly, 1024, 1024, true],
  ["heading-only", brokenHeadingOnly, 1024, 1008, true],
  ["axes-swapped", brokenAxesSwapped, 1024, 1024, true],
  ["no-carry", brokenNoCarry, 0, 710, false],
  ["second-skipped", brokenSecondSkipped, 1004, 960, true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: flyAlongHeadingAtDoubleVelocity == oracle on the whole dump", { skip }, () => {
  const r = gate(flyAlongHeadingAtDoubleVelocity);
  assert.notEqual(entry, null, "vacuous: the attract run never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  console.log(`  EQUAL: entry table/heading ${shapeOf(entryState())}; identical`);
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
  flyAlongHeadingAtDoubleVelocity(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    MOVED,
    "the excluded set changed shape",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${MOVED.join(", ")} and pc`);
});

test("LATE FIRST DISPATCH: the budget has to be several times the shared one", { skip }, () => {
  const { firstFrame } = captureCorpus();
  assert.ok(
    firstFrame > SHARED_BUDGET,
    "this now dispatches inside the budget the other gates use, so the long run here is no longer " +
      "buying anything and this arm can be dropped",
  );
  assert.ok(firstFrame < FIRST_DISPATCH_BEFORE, "the first dispatch moved past the budget");
  console.log(`  LATE: the first dispatch arrives on frame ${firstFrame} of ${FRAMES}`);
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const { entries, tables, headings } = captureCorpus();
  assert.equal(entries.length, DISPATCHES, "the dispatch count moved");
  assert.equal(tables.size, 1, "the attract run now reaches more than one speed table");
  for (const captured of entries) {
    assert.equal(unitDiff(flyAlongHeadingAtDoubleVelocity, captured), null, "a captured dispatch diverged");
  }
  console.log(`  CORPUS: ${entries.length} dispatches, 1 table, ${headings.size} headings`);
});

test("EXHAUSTIVE: 256 headings on each of four speed tables", { skip }, () => {
  for (const t of TABLES) {
    for (const h of EVERY_HEADING) {
      const d = unitDiff(flyAlongHeadingAtDoubleVelocity, selector(t, h));
      assert.equal(d, null, `${hex4(t)}/${h}: ${show(d)}`);
    }
  }
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} table-and-heading combinations identical`);
});

test("CRAFTED: every displacement x position x selector combination is identical", { skip }, () => {
  for (const c of cross()) {
    const d = unitDiff(flyAlongHeadingAtDoubleVelocity, craft(...c));
    assert.equal(d, null, `${hex4(c[0])}/${c[1]}: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${cross().length} combinations identical`);
});

test("THE STEP IS DOUBLED: the move is the world plus TWICE the component", { skip }, () => {
  const m = craft(TABLES[0], 37, 0x0100, 0x0080, POSITIONS[3]);
  const [a, b] = componentsOf(m);
  const before = [
    (m.mem8[first(m)] << 8) + m.mem8[firstFraction(m)],
    (m.mem8[second(m)] << 8) + m.mem8[secondFraction(m)],
  ];
  flyAlongHeadingAtDoubleVelocity(m);
  const after = [
    (m.mem8[first(m)] << 8) + m.mem8[firstFraction(m)],
    (m.mem8[second(m)] << 8) + m.mem8[secondFraction(m)],
  ];
  assert.equal((after[0] - before[0]) & 0xffff, (0x0100 + 2 * a) & 0xffff, "the first axis moved wrong");
  assert.equal((after[1] - before[1]) & 0xffff, (0x0080 + 2 * b) & 0xffff, "the second axis moved wrong");
  assert.notEqual(a, 0, "the component must be non-zero here, or the doubling is unobservable");
  console.log(`  DOUBLED: moved by the world plus 2x(${hex4(a)}, ${hex4(b)})`);
});

test("WHOLE-MACHINE: the session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(flyAlongHeadingAtDoubleVelocity);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, FRAMES, "the replay ran short");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches`);
});

test("TEETH: removing the shim's return kills the run, so the shim is load-bearing", { skip }, () => {
  let died = null;
  try {
    const w = wholeMachineEquivalence(factory, FRAMES, new Map([[TARGET, flyAlongHeadingAtDoubleVelocity]]));
    died = w.equal ? null : "forked";
  } catch (e) {
    died = String(e).slice(0, 80);
  }
  assert.notEqual(died, null, "the unshimmed rewrite ran clean, so the shim proves nothing");
  console.log(`  TEETH/shim: the unshimmed rewrite dies — ${died}`);
});

for (const [label, twin, swept, crafted, seenAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exact counts of both sweeps`, { skip }, () => {
    assert.equal(sweepCaught(twin), swept, `the ${label} twin's heading catch count moved`);
    assert.equal(crossCaught(twin), crafted, `the ${label} twin's crafted catch count moved`);
    console.log(`  TEETH/${label}: headings ${swept}/${SWEEP_SIZE}, crafted ${crafted}/${cross().length}`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const seen = caught(twin, entryState());
    assert.equal(seen, seenAtDispatch, `the real dispatch's view of the ${label} twin moved`);
    console.log(`  TEETH/${label}: real dispatch ${seen ? "catches it" : "is BLIND, as recorded"}`);
  });
}
