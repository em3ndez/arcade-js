// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyAlongHeading — memory-equivalent to the frozen oracle at ROM 0x58BC.
 *
 * GATE: strict unit-capture, a corpus of real dispatches from three tapes, an exhaustive heading
 *   sweep, a crafted cross over the two displacement cells and the four coordinate bytes, and a
 *   whole-machine replay of driven play. RAM IS A REAL GATE HERE — the routine writes four bytes
 *   and the NOT VACUOUS arm proves a do-nothing candidate fails on RAM alone at the real dispatch.
 *
 * LIVE-OUT is memory only, derived from the CALLERS rather than from the instruction sequence.
 *   Every path in is a tail transfer, so the `ret` lands on a continuation further up. The ones
 *   reached from the direct callers are `call 0x2B83`, whose first act is `ld a,(iy+0x31)`, and
 *   loc_2c31, which opens `ld a,(ix+0x00)`: both load the accumulator from memory before reading
 *   anything, and neither branches on a flag this routine set. Longer tail chains are NOT traced
 *   by hand — the WHOLE-MACHINE arm is what covers them, and it is the falsifiable version of the
 *   whole claim, since a register some caller really consumed would fork the run.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump.
 *   2. NOT VACUOUS — a no-op candidate FAILS that same RAM diff, so flavour-one vacuity (a
 *      register-only routine whose RAM diff passes anything) does not apply to this file.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to a fixed shape so "excluded"
 *      cannot quietly widen. The second component survives in the same register pair on both
 *      arms, which is why that pair is absent from the moved set.
 *   4. DEAD FIRST DISPATCH — unitEquivalence clones the FIRST entry and no `maxFrames` changes
 *      which one that is; the test doubles the budget and asserts the same entry comes back.
 *   5. DEGENERATE ENTRY — that entry sits on a cardinal heading whose second component is zero,
 *      beside a second displacement cell that is also zero, so the whole second coordinate is
 *      inert there and both fractions are zero so no carry ever happens. Two of the seven twins
 *      are INVISIBLE at it, and the test asserts exactly which.
 *   6. UNIFORM CORPUS — the shared tape holds one speed table and skips a contiguous band of
 *      headings outright. Three tapes are captured (shared, the stick walked round the compass,
 *      undriven attract) and the sweep covers the two tables no tape reaches.
 *   7. CRAFTED CROSS — the real entry with both displacement cells and all four coordinate bytes
 *      poked identically on both sides, over displacements (zero, carry-generating, sign-flipping,
 *      both sign extremes) x positions (both ends of each byte) x four selectors.
 *   8. CARRY — one fraction swept 0..255, the only way the carry into the whole byte is covered.
 *   9. TEETH — seven twins at seven different behaviours, each caught on an EXACT declared set:
 *      per-table survivor lists over the heading sweep, an exact catch count over the crafted
 *      cross, the real dispatch's blindness pinned, and a fork of the whole machine. The no-op's
 *      two blind headings are re-derived FROM THE TABLE DATA rather than from the twin.
 *
 * The whole-machine replay needs a shim. The host engine is cycle-driven and every caller arrives
 * by a tail transfer, so a candidate that charges no T-states and does not take the Z80 return
 * both moves the vblank interrupt and leaks two stack bytes per dispatch. The shim pays both,
 * identically for the real arm and for every twin, and its branch-dependent total is checked
 * against the oracle over the whole sweep rather than assumed.
 *
 * HOLE: a handful of object slots. The three tapes between them produce only a few distinct pairs
 * of record bases, so the crafted cross varies the values read, not the bases they are read from.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-58bc.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyAlongHeading } from "../flyAlongHeading.js";
import { loc_58bc as oracle } from "../../translated/loc_58bc.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x58bc;

/** The heading byte's offset inside the record the caller points at. */
const HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

/** The two cells holding the displacement every object gets this frame. */
const SCROLL_FIRST = 0xa808;
const SCROLL_SECOND = 0xa80a;

/** The four speed tables the callers hand in. Only the first two appear in any tape. */
const TABLES = [0x59d7, 0x5e00, 0x2e3e, 0x08fa];

const MOVED = ["a", "f", "d", "e", "h", "l", "sp"];

const CORPUS_FRAMES = 1500;
const WHOLE_FRAMES = 1400;

/** T-states charged before the return, on the path where all three branches fall through. */
const STRAIGHT_LINE = 345;
const RET_TSTATES = 10;

const IN0 = 0xc300;
const IN1 = 0xc320;
const COIN = 0x01;
const START = 0x08;
const LEFT = 0x01;
const RIGHT = 0x02;
const UP = 0x04;
const DOWN = 0x08;
const FIRE = 0x10;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const everyHeading = Array.from({ length: HEADINGS }, (_unused, h) => h);

// The four bytes the routine writes, addressed off the two record bases the caller supplies.
const wholeFirst = (m) => (m.regs.iy + 49) & 0xffff;
const fractionFirst = (m) => (m.regs.ix + 3) & 0xffff;
const wholeSecond = (m) => m.regs.iy & 0xffff;
const fractionSecond = (m) => (m.regs.ix + 5) & 0xffff;
const WRITTEN = [wholeFirst, fractionFirst, wholeSecond, fractionSecond];

const headingOf = (mm) => mm.mem8[(mm.regs.ix + HEADING_CELL) & 0xffff];
const keyOf = (mm) => `${hex4(mm.regs.hl)}/${headingOf(mm)}`;

/** The two perpendicular components a heading selects, re-derived here rather than imported. */
const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];
const componentsOf = (m) => [
  sampleAt(m, m.regs.hl, headingOf(m)),
  sampleAt(m, m.regs.hl, headingOf(m) - QUARTER),
];

/**
 * The shared tape, plus the stick walked once round the compass. Without it the plane holds one
 * heading for the whole run and a wide band of this routine's selector space never occurs.
 */
function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: COIN, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: START, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: FIRE, dur: WHOLE_FRAMES },
  ];
  const compass = [
    LEFT, LEFT | UP, UP, UP | RIGHT, RIGHT, RIGHT | DOWN,
    DOWN, DOWN | LEFT, LEFT, UP, RIGHT, DOWN,
  ];
  let frame = TURN_FIRST_FRAME;
  for (const bits of compass) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const TAPES = [
  ["shared", {}],
  ["turning", { tape: turnTape() }],
  ["attract", { tape: [] }],
];

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

/** One pristine machine per distinct (table, heading) pair, over all three tapes. */
function captureCorpus() {
  if (corpus) return corpus;
  const byKey = new Map();
  const perTape = [];
  for (const [label, opts] of TAPES) {
    let dispatches = 0;
    const headings = new Set();
    const tables = new Set();
    const m = makeMachine(
      new Map([[TARGET, (mm) => {
        dispatches++;
        headings.add(headingOf(mm));
        tables.add(mm.regs.hl);
        if (!byKey.has(keyOf(mm))) byKey.set(keyOf(mm), mm.clone());
        return oracle(mm);
      }]]),
      opts,
    );
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `${label} capture stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, `${label} capture ran short`);
    perTape.push({ label, dispatches, headings, tables });
  }
  corpus = { entries: [...byKey.values()], perTape };
  return corpus;
}

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

/** The gate itself, with the entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(flyAlongHeading);
  return entry;
}

/** Oracle vs candidate on independent clones of one machine, diffed on RAM. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A real captured machine nudged onto one (table, heading), which is the crafted-entry idiom. */
function selector(table, heading) {
  const m = entryState().clone();
  m.regs.hl = table;
  m.mem8[(m.regs.ix + HEADING_CELL) & 0xffff] = heading;
  return m;
}

/** The same, with both displacement cells and all four written bytes forced as well. */
function craft(sel, prior) {
  const m = selector(sel[0], sel[1]);
  m.mem16[SCROLL_FIRST] = prior.dA;
  m.mem16[SCROLL_SECOND] = prior.dB;
  m.mem8[wholeFirst(m)] = prior.wA;
  m.mem8[fractionFirst(m)] = prior.fA;
  m.mem8[wholeSecond(m)] = prior.wB;
  m.mem8[fractionSecond(m)] = prior.fB;
  return m;
}

// Zero, +1, a low-byte-only step, a whole step, a step and a half, both sign extremes, and two
// negatives.
const SCROLLS = [0x0000, 0x0001, 0x00ff, 0x0100, 0x0180, 0x7fff, 0x8000, 0xfe80, 0xffff];

const POSITIONS = [
  { wA: 0, fA: 0, wB: 0, fB: 0 },
  { wA: 0, fA: 255, wB: 255, fB: 0 },
  { wA: 255, fA: 255, wB: 255, fB: 255 },
  { wA: 138, fA: 203, wB: 129, fB: 88 },
  { wA: 1, fA: 1, wB: 254, fB: 254 },
];

/** One selector per table: a cardinal heading, a quarter turn, an oblique one, and the wrap edge. */
const SELECTORS = [[TABLES[0], 0], [TABLES[1], QUARTER], [TABLES[2], 137], [TABLES[3], 255]];

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  for (const sel of SELECTORS) {
    for (const dA of SCROLLS) {
      for (const dB of SCROLLS) {
        for (const p of POSITIONS) out.push([sel, { ...p, dA, dB }]);
      }
    }
  }
  crossCache = out;
  return out;
}

/** One fraction byte swept 0..255 with a +1 step, so the carry into the whole byte is hit. */
function carryPriors() {
  const out = [];
  for (let f = 0; f < HEADINGS; f++) out.push({ wA: 200, fA: f, wB: 7, fB: f, dA: 1, dB: 0xffff });
  return out;
}

// ── the cycle shim ──────────────────────────────────────────────────────────────────────

/**
 * The oracle's own T-state total. Each of its three branches costs one LESS when the carry it
 * tests is set, because the skipped path pays a taken jump and the other pays a fall-through plus
 * a one-byte instruction; the third arm loads a second constant instead.
 */
function oracleTStates(m) {
  const heading = headingOf(m);
  const doubled = (2 * heading) & 0xff;
  return (
    STRAIGHT_LINE +
    (heading & 0x80 ? 11 : 12) +
    (doubled + m.regs.l > 255 ? 11 : 12) +
    (heading >= QUARTER ? 17 : 12)
  );
}

/** Adapt a candidate to the cycle-driven host: pay the oracle's total, then take the return. */
function hosted(candidate) {
  return (mm) => {
    const total = oracleTStates(mm);
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

function replay(candidate) {
  return wholeMachineEquivalence(
    turningMachine,
    WHOLE_FRAMES,
    new Map([[TARGET, hosted(candidate)]]),
  );
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: flyAlongHeading == oracle on RAM", { skip }, () => {
  const r = gate(flyAlongHeading);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const e = entryState();
  console.log(
    `  EQUAL: entry ${keyOf(e)} bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} within ` +
      `${ENTRY_FRAMES} frames; RAM identical`,
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the RAM diff at the real dispatch", { skip }, () => {
  const r = gate(brokenNoOp);
  assert.notEqual(
    r.ram,
    null,
    "the RAM diff passed a candidate that does nothing, so RAM is NOT this gate — the " +
      "routine's effect would have to be registers and the whole file must be re-derived",
  );
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(r.ram)}`);
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  flyAlongHeading(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved,
    MOVED,
    "the excluded set changed shape: the pair carrying the second component must agree on " +
      "both arms, and nothing beyond the scratch registers and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  for (const at of WRITTEN) assert.equal(a.mem8[at(a)], b.mem8[at(b)], `live-out ${hex4(at(a))}`);
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM unaffected`);
});

test("DEAD FIRST DISPATCH: doubling the budget captures the SAME entry", { skip }, () => {
  const first = entryState();
  let later = null;
  unitEquivalence(makeMachine, TARGET, oracle, (m) => {
    if (later === null) later = m.clone();
    return flyAlongHeading(m);
  }, { maxFrames: 2 * ENTRY_FRAMES });
  assert.notEqual(later, null, "vacuous: the doubled budget never reached the routine");
  assert.equal(keyOf(later), keyOf(first), "a longer run must not change which entry is cloned");
  assert.equal(later.regs.ix, first.regs.ix, "nor which object slot it came from");
  console.log(`  DEAD FIRST DISPATCH: ${keyOf(first)} at both budgets — only crafting escapes it`);
});

test("DEGENERATE ENTRY: the second coordinate is inert and no fraction carries", { skip }, () => {
  const e = entryState();
  const [first, second] = componentsOf(e);
  assert.equal(second, 0, "the entry's second component is expected to be zero");
  assert.equal(e.mem16[SCROLL_SECOND], 0, "and so is the second displacement cell");
  assert.notEqual(first, 0, "the first component is not, which is what keeps the arm above alive");
  assert.equal(e.mem8[fractionFirst(e)], 0, "both fractions are zero here, so nothing can carry");
  assert.equal(e.mem8[fractionSecond(e)], 0, "both fractions are zero here, so nothing can carry");

  const after = e.clone();
  oracle(after);
  const stationary = WRITTEN.filter((at) => e.mem8[at(e)] === after.mem8[at(after)]);
  assert.equal(stationary.length, 2, "exactly the second coordinate's two bytes must stand still");
  console.log(
    `  DEGENERATE: components ${hex4(first)}/${hex4(second)}, displacements ` +
      `${hex4(e.mem16[SCROLL_FIRST])}/${hex4(e.mem16[SCROLL_SECOND])}; two written bytes inert`,
  );
});

test("UNIFORM CORPUS: real play holds one table and skips a band of headings", { skip }, () => {
  const { perTape } = captureCorpus();
  for (const t of perTape) {
    assert.ok(t.dispatches > 0, `vacuous: the ${t.label} tape never reached the routine`);
  }
  const shared = perTape.find((t) => t.label === "shared");
  const turning = perTape.find((t) => t.label === "turning");
  assert.equal(shared.tables.size, 1, "the shared tape is expected to hold a single table");
  assert.ok(shared.headings.size < HEADINGS, "the shared tape cannot cover the heading circle");
  assert.equal(turning.headings.size, HEADINGS, "walking the stick round must cover all of it");

  const everyTable = new Set(perTape.flatMap((t) => [...t.tables]));
  assert.ok(everyTable.size < TABLES.length, "no tape reaches every table — the sweep must");
  const seen = perTape.map((t) => `${t.label} ${t.dispatches}/${t.headings.size}`).join(", ");
  console.log(`  UNIFORM CORPUS: ${seen} (dispatches/headings); ${everyTable.size} tables in play`);
});

test("CORPUS: every captured (table, heading) pair replays identically", { skip }, () => {
  const { entries } = captureCorpus();
  for (const captured of entries) {
    const d = unitDiff(flyAlongHeading, captured);
    assert.equal(d, null, `${keyOf(captured)}: ${show(d)}`);
  }
  console.log(`  CORPUS: ${entries.length} distinct pairs replayed, RAM identical on each`);
});

test("EXHAUSTIVE: 256 headings on each of the four tables are identical", { skip }, () => {
  let swept = 0;
  for (const table of TABLES) {
    for (const heading of everyHeading) {
      const d = unitDiff(flyAlongHeading, selector(table, heading));
      assert.equal(d, null, `${hex4(table)}/${heading}: ${show(d)}`);
      swept++;
    }
  }
  assert.equal(swept, TABLES.length * HEADINGS, "the sweep did not cover the whole space");
  console.log(`  EXHAUSTIVE: ${swept} (table, heading) combinations identical`);
});

test("CRAFTED: every displacement x position x selector combination is identical", { skip }, () => {
  for (const [sel, p] of cross()) {
    const d = unitDiff(flyAlongHeading, craft(sel, p));
    assert.equal(d, null, `${hex4(sel[0])}/${sel[1]} ${JSON.stringify(p)}: ${show(d)}`);
  }
  const expected = SELECTORS.length * SCROLLS.length ** 2 * POSITIONS.length;
  assert.equal(cross().length, expected, "the crafted cross shrank");
  console.log(`  CRAFTED: ${cross().length} entries identical`);
});

test("CARRY: a fraction swept 0..255 carries into the whole byte as the oracle does", { skip }, () => {
  const priors = carryPriors();
  for (const p of priors) {
    const d = unitDiff(flyAlongHeading, craft(SELECTORS[0], p));
    assert.equal(d, null, `fraction=${p.fA}: ${show(d)}`);
  }
  const wrapped = craft(SELECTORS[1], { wA: 255, fA: 255, wB: 0, fB: 0, dA: 1, dB: 0 });
  assert.equal(componentsOf(wrapped)[0], 0, "this selector's first component must be zero here");
  flyAlongHeading(wrapped);
  assert.equal(wrapped.mem8[wholeFirst(wrapped)], 0, "the whole byte must round, not widen");
  assert.equal(wrapped.mem8[fractionFirst(wrapped)], 0, "and the fraction must round with it");
  console.log(`  CARRY: ${priors.length} fractions identical, including the wrap to zero`);
});

test("EXHAUSTIVE: the shim charges exactly what the oracle charges", { skip }, () => {
  for (const table of TABLES) {
    for (const heading of everyHeading) {
      const m = selector(table, heading);
      const predicted = oracleTStates(m);
      const before = m.cycles;
      oracle(m);
      assert.equal(m.cycles - before, predicted, `${hex4(table)}/${heading}: shim total is wrong`);
    }
  }
  console.log("  EXHAUSTIVE: the shim's T-state total matches the oracle on every combination");
});

test("WHOLE-MACHINE: driven play is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(flyAlongHeading);
  const fired = w.invocations.get(TARGET);
  assert.ok(fired > 0, "vacuous: the override never dispatched in this many frames");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${fired} dispatches, RAM identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Seven ways to get this routine wrong, each a DIFFERENT behaviour: doing nothing, dropping
// either of the two terms, applying one of them twice, crossing the two axes, losing the carry
// between a coordinate's halves, and forgetting the second coordinate. Each must be caught by
// the same comparisons the real arm passes, on an exactly declared set.

/** The correct split store, so the twins below break the DISPLACEMENT rather than the store. */
function store(m, wholeAddr, fractionAddr, displacement) {
  const moved = (m.mem8[wholeAddr] << 8) + m.mem8[fractionAddr] + displacement;
  m.mem8[wholeAddr] = moved >> 8;
  m.mem8[fractionAddr] = moved;
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: carries the object with the world but never along the heading it points. */
function brokenScrollOnly(m) {
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[SCROLL_FIRST]);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[SCROLL_SECOND]);
}

/** BUG: flies the object but pins it to the world instead of letting the world stream past. */
function brokenHeadingOnly(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), first);
  store(m, wholeSecond(m), fractionSecond(m), second);
}

/** BUG: applies the heading step twice, which is the double-speed behaviour. */
function brokenDoubleStep(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[SCROLL_FIRST] + 2 * first);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[SCROLL_SECOND] + 2 * second);
}

/** BUG: each coordinate gets the other coordinate's component, so the object flies sideways. */
function brokenAxesSwapped(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[SCROLL_FIRST] + second);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[SCROLL_SECOND] + first);
}

/** BUG: adds each half of a displacement to its own byte, so a fraction overflow never banks. */
function brokenNoCarry(m) {
  const [first, second] = componentsOf(m);
  const dA = (m.mem16[SCROLL_FIRST] + first) & 0xffff;
  const dB = (m.mem16[SCROLL_SECOND] + second) & 0xffff;
  m.mem8[wholeFirst(m)] = m.mem8[wholeFirst(m)] + (dA >> 8);
  m.mem8[fractionFirst(m)] = m.mem8[fractionFirst(m)] + (dA & 0xff);
  m.mem8[wholeSecond(m)] = m.mem8[wholeSecond(m)] + (dB >> 8);
  m.mem8[fractionSecond(m)] = m.mem8[fractionSecond(m)] + (dB & 0xff);
}

/** BUG: moves the first coordinate and forgets the second one entirely. */
function brokenSecondSkipped(m) {
  const [first] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[SCROLL_FIRST] + first);
}

/**
 * Per twin: the headings it SURVIVES on a given table, its exact catch count over the crafted
 * cross, and whether the real dispatch can see it at all. Measured, and asserted as a partition
 * of the 256 rather than as a bare count, so a twin caught on the wrong set fails as loudly as
 * one that is not caught.
 */
const TWINS = [
  ["no-op", brokenNoOp, (t) => (t === TABLES[1] ? [127, 128] : []), 1620, true],
  ["scroll-only", brokenScrollOnly, () => [], 1620, true],
  ["heading-only", brokenHeadingOnly, () => [], 1600, true],
  ["double-step", brokenDoubleStep, () => [], 1620, true],
  ["axes-swapped", brokenAxesSwapped, () => [], 1620, true],
  ["no-carry", brokenNoCarry, () => everyHeading, 1140, false],
  ["second-skipped", brokenSecondSkipped, inertHeadings, 1530, false],
];

for (const [label, twin, survives, crossCaught, caughtAtDispatch] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared headings`, { skip }, () => {
    let total = 0;
    for (const table of TABLES) {
      const caught = [];
      const missed = [];
      for (const h of everyHeading) {
        (unitDiff(twin, selector(table, h)) === null ? missed : caught).push(h);
      }
      assert.deepEqual(missed, survives(table), `${label} on ${hex4(table)}: wrong survivor set`);
      assert.deepEqual(
        [...caught, ...missed].sort((x, y) => x - y),
        everyHeading,
        "caught and missed must PARTITION the headings, sharing none and omitting none",
      );
      total += caught.length;
    }
    console.log(`  TEETH/${label}: caught on ${total} of ${TABLES.length * HEADINGS} headings`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = cross().filter(([sel, p]) => unitDiff(twin, craft(sel, p)) !== null).length;
    assert.equal(caught, crossCaught, `the ${label} twin's crafted catch count moved`);
    assert.ok(caught > 0, `the crafted cross missed the ${label} twin everywhere`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${cross().length} crafted entries`);
  });

  test(`TEETH: the ${label} twin at the real dispatch, hole pinned`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    assert.equal(
      d !== null,
      caughtAtDispatch,
      `the real dispatch's blindness to the ${label} twin changed — re-derive the holes`,
    );
    console.log(`  TEETH/${label}: real dispatch ${d ? `caught — ${show(d)}` : "BLIND, as recorded"}`);
  });

  test(`TEETH: the ${label} twin FORKS the whole machine`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(w.equal, false, `the ${label} twin ran clean — the replay has no teeth`);
    console.log(`  TEETH/${label}: forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  });
}

/** Headings where the second coordinate's whole displacement is zero at the captured entry. */
function inertHeadings(table) {
  const m = entryState();
  const scroll = m.mem16[SCROLL_SECOND];
  return everyHeading.filter((h) => ((sampleAt(m, table, h - QUARTER) + scroll) & 0xffff) === 0);
}

test("TEETH: the no-op's blind headings come from the DATA, not from the twin", { skip }, () => {
  const m = entryState();
  const first = m.mem16[SCROLL_FIRST];
  const second = m.mem16[SCROLL_SECOND];
  for (const table of TABLES) {
    const cancelling = everyHeading.filter(
      (h) =>
        ((sampleAt(m, table, h) + first) & 0xffff) === 0 &&
        ((sampleAt(m, table, h - QUARTER) + second) & 0xffff) === 0,
    );
    assert.deepEqual(
      cancelling,
      table === TABLES[1] ? [127, 128] : [],
      `${hex4(table)}: the headings where both displacements cancel changed`,
    );
  }
  console.log("  TEETH: the two blind headings are exactly where both displacements cancel");
});
