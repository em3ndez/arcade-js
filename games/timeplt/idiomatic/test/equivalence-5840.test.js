// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyAtSlowestSpeed — memory-equivalent to the frozen oracle at ROM 0x5840.
 *
 * WHAT IT IS. Two instructions: load a fixed table pointer, then tail-jump to the per-object move
 * at 0x58BC, which IS ALREADY DECOMPILED — so the rewrite calls flyAlongHeading directly with the table
 * as an argument, and dissolving that transfer belongs to this caller's unit. The whole content of
 * the routine is therefore the CHOICE OF TABLE plus the fact that the pointer a caller was already
 * holding is thrown away. Both of those are what this gate has to be able to see, and the twin
 * list is built around them: three twins hand the move one of the other tables the same move is
 * given elsewhere, one nudges the pointer by a single entry, one drops its high byte, and one
 * forwards the caller's own pointer instead of the fixed one.
 *
 * LIVE-OUT is memory only, and it is MEASURED rather than argued: a whole driven session with
 *   every register the routine could leave behind (a, f, bc, de, hl) forced hostile AFTER every
 *   dispatch is bit-identical to the clean run, and the tooth beside it shows the instrument
 *   reaches the routine — the same session with ix or iy nudged forks it.
 *
 * GATE: strict unit-capture, three replayed real sessions at every dispatch, an exhaustive
 *   heading sweep, a crafted cross, a carry sweep, and a whole-machine replay of driven play.
 *   RAM IS A REAL GATE HERE — the NOT VACUOUS arm proves a do-nothing candidate fails on RAM
 *   alone at the real dispatch. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM byte-identical across the whole state dump.
 *   2. NOT VACUOUS — a no-op candidate FAILS that same diff, so flavour-one vacuity (a
 *      register-only routine whose RAM diff passes anything) does not apply to this file.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and bounded: nothing outside the declared
 *      set may diverge, while a rewrite that diverges on fewer of them is free to.
 *   4. DEAD FIRST DISPATCH — unitEquivalence clones the FIRST entry and no frame budget changes
 *      which one; the test doubles the budget and asserts the same entry comes back.
 *   5. DEGENERATE ENTRY — that entry sits on a cardinal heading whose second component is zero,
 *      beside a second displacement cell that is also zero, and both fractions are zero, so no
 *      carry can happen there. Two of the twelve twins are INVISIBLE at it and the test says which.
 *   6. UNIFORM CORPUS — the shared tape skips a contiguous band of 92 headings outright, and no
 *      tape can vary the table, because the table IS the routine. Three sessions are run (shared,
 *      the stick walked round the compass, undriven attract); the band the shared tape misses is
 *      asserted absent from it, present in the turning tape, and driven from crafted entries.
 *   7. CORPUS — all three sessions replayed at EVERY dispatch, not a deduplicated sample.
 *   8. CRAFTED CROSS — the real entry with both displacement cells and all four coordinate bytes
 *      poked identically on both sides, over displacements x positions x four headings.
 *   9. CARRY — one fraction swept 0..255. The captured entry has both fractions at zero, so this
 *      is the only crafted arm that reaches the carry between a coordinate's halves; the real
 *      sessions reach it too, which is why the no-carry twin dies there and not in the sweep.
 *  10. THE INCOMING POINTER IS IGNORED — measured the same way as the live-out, by forcing it
 *      hostile BEFORE every dispatch of a whole session.
 *  11. TEETH — twelve twins at twelve distinct behaviours, each caught on an EXACTLY declared set:
 *      a survivor list over the heading sweep, a catch count over the crafted cross, the real
 *      dispatch's blindness pinned, per-session catch counts, and a fork of the whole machine.
 *
 * The whole-machine replay needs a shim, because the host engine is cycle-driven and every path
 * in is a transfer that ends in the move's own return: a candidate charging no T-states and not
 * taking that return would move the vblank interrupt and leak two stack bytes per dispatch. The
 * shim pays both, identically for the real arm and for every twin, and its branch-dependent total
 * is checked against the oracle over all 256 headings rather than assumed.
 *
 * HOLE: object slots. The three sessions between them present six record bases, and the crafted
 * arms vary the values read rather than the bases they are read from.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5840.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyAtSlowestSpeed } from "../flyAtSlowestSpeed.js";
import { flyAlongHeading } from "../flyAlongHeading.js";
import { loc_5840 as oracle } from "../../translated/loc_5840.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";

const TARGET = 0x5840;

/** The one table this entry exists to select. */
const VELOCITY_TABLE = 0x59d7;

/** The tables the same move is handed from other entry points, and two malformed pointers. */
const OTHER_TABLES = [0x5e00, 0x2e3e, 0x08fa];
const OFF_BY_ONE_ENTRY = VELOCITY_TABLE + 2;
const LOW_BYTE_ONLY = 0x5800 | (VELOCITY_TABLE & 0xff);

const HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

const MOVED = ["a", "f", "d", "e", "h", "l", "sp"];

const CORPUS_FRAMES = 1500;
const WHOLE_FRAMES = 1400;

/**
 * T-states: the two instructions of this entry, then the move's straight-line total including its
 * return. The move's three branches each cost one less when the carry they test is set.
 */
const THUNK_TSTATES = 20;
const STRAIGHT_LINE = 345;
const RET_TSTATES = 10;

/** The low half of the fixed pointer, which is what decides the move's second branch. */
const TABLE_LOW = VELOCITY_TABLE & 0xff;

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

// The four bytes the move writes, addressed off the two record bases the caller supplies.
const wholeFirst = (m) => (m.regs.iy + 49) & 0xffff;
const fractionFirst = (m) => (m.regs.ix + 3) & 0xffff;
const wholeSecond = (m) => m.regs.iy & 0xffff;
const fractionSecond = (m) => (m.regs.ix + 5) & 0xffff;
const WRITTEN = [wholeFirst, fractionFirst, wholeSecond, fractionSecond];

const headingOf = (mm) => mm.mem8[(mm.regs.ix + HEADING_CELL) & 0xffff];

/** The two perpendicular components the fixed table gives a heading, re-derived here. */
const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];
const componentsOf = (m) => [
  sampleAt(m, VELOCITY_TABLE, headingOf(m)),
  sampleAt(m, VELOCITY_TABLE, headingOf(m) - QUARTER),
];

/**
 * The shared tape, plus the stick walked once round the compass. Without it the plane holds one
 * heading for the whole run and a wide band of the selector space never occurs.
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

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 1149, turning: 2168, attract: 112 };

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

/** The required contract call, with the entry state harvested off the candidate arm's clone. */
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
  if (entry === null) gate(flyAtSlowestSpeed);
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

/** A real captured machine nudged onto one heading, which is the crafted-entry idiom. */
function selector(heading) {
  const m = entryState().clone();
  m.mem8[(m.regs.ix + HEADING_CELL) & 0xffff] = heading;
  return m;
}

/** The same, with both displacement cells and all four written bytes forced as well. */
function craft(heading, prior) {
  const m = selector(heading);
  m.mem16[WORLD_SCROLL_Y] = prior.dA;
  m.mem16[WORLD_SCROLL_X] = prior.dB;
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

/** A cardinal heading, a quarter turn, an oblique one, and the wrap edge. */
const CRAFT_HEADINGS = [0, QUARTER, 137, HEADINGS - 1];

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  for (const heading of CRAFT_HEADINGS) {
    for (const dA of SCROLLS) {
      for (const dB of SCROLLS) {
        for (const p of POSITIONS) out.push([heading, { ...p, dA, dB }]);
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

// ── replaying a whole session, one dispatch at a time ───────────────────────────────────
// Cloning at the dispatch and diffing straight away keeps memory flat, so every dispatch of every
// session is compared rather than a deduplicated sample of them.

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const headings = new Set();
  const pointers = new Set();
  const bases = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      headings.add(headingOf(mm));
      pointers.add(mm.regs.hl);
      bases.add(mm.regs.ix);
      const b = mm.clone();
      const r = oracle(mm);
      candidate(b);
      const d = firstStateDiff(mm.dumpState(), b.dumpState(), (o) => mm.stateOffsetToAddr(o));
      if (d) caught++;
      return r;
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, headings, pointers, bases };
}

let sessionCache = null;
/** The three sessions replayed against the rewrite, which also collects what each one varies. */
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, flyAtSlowestSpeed) }));
  return sessionCache;
}

// ── whole-session hostile-register instruments ──────────────────────────────────────────

/** Two whole driven sessions diffed frame by frame: clean, and one mutated at every dispatch. */
function hostileSession(mutate) {
  const base = makeMachine();
  const baseFrames = base.runFrames(CORPUS_FRAMES);
  let dispatches = 0;
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches += 1;
    return mutate(mm);
  }]]));
  const hostFrames = host.runFrames(CORPUS_FRAMES);
  const addrs = new Set();
  const n = Math.min(baseFrames.length, hostFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseFrames[i];
    const y = hostFrames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) addrs.add(base.stateOffsetToAddr(o));
  }
  return { cells: addrs.size, frames: n, dispatches, stopped: base.stoppedBy ?? host.stoppedBy };
}

const LEFT_BEHIND = ["a", "f", "bc", "de", "hl"];

// ── the cycle shim ──────────────────────────────────────────────────────────────────────

function oracleTStates(m) {
  const heading = headingOf(m);
  const doubled = (2 * heading) & 0xff;
  return (
    THUNK_TSTATES +
    STRAIGHT_LINE +
    (heading & 0x80 ? 11 : 12) +
    (doubled + TABLE_LOW > 255 ? 11 : 12) +
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

// ── the twins ───────────────────────────────────────────────────────────────────────────
// Twelve ways to get this routine wrong. The first six are about the POINTER, which is the whole
// of what this entry decides; the rest break the move itself, so the gate is not merely trusting
// that the transfer went somewhere.

/** The correct split store, so a twin below breaks the DISPLACEMENT rather than the store. */
function store(m, wholeAddr, fractionAddr, displacement) {
  const moved = (m.mem8[wholeAddr] << 8) + m.mem8[fractionAddr] + displacement;
  m.mem8[wholeAddr] = moved >> 8;
  m.mem8[fractionAddr] = moved;
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: uses the pointer the caller happened to be holding instead of overriding it. */
function brokenForwardsPointer(m) {
  flyAlongHeading(m, m.regs.hl);
}

/** BUG: the pointer is off by a single entry, so every heading reads its neighbour. */
function brokenOffByOneEntry(m) {
  flyAlongHeading(m, OFF_BY_ONE_ENTRY);
}

/** BUG: only the low half of the pointer is loaded, so the page is whatever was there. */
function brokenLowByteOnly(m) {
  flyAlongHeading(m, LOW_BYTE_ONLY);
}

/** BUG: carries the object with the world but never along the heading it points. */
function brokenScrollOnly(m) {
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[WORLD_SCROLL_Y]);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[WORLD_SCROLL_X]);
}

/** BUG: flies the object but pins it to the world instead of letting the world stream past. */
function brokenHeadingOnly(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), first);
  store(m, wholeSecond(m), fractionSecond(m), second);
}

/** BUG: each coordinate gets the other coordinate's component, so the object flies sideways. */
function brokenAxesSwapped(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[WORLD_SCROLL_Y] + second);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[WORLD_SCROLL_X] + first);
}

/** BUG: adds each half of a displacement to its own byte, so a fraction overflow never banks. */
function brokenNoCarry(m) {
  const [first, second] = componentsOf(m);
  const dA = (m.mem16[WORLD_SCROLL_Y] + first) & 0xffff;
  const dB = (m.mem16[WORLD_SCROLL_X] + second) & 0xffff;
  m.mem8[wholeFirst(m)] = m.mem8[wholeFirst(m)] + (dA >> 8);
  m.mem8[fractionFirst(m)] = m.mem8[fractionFirst(m)] + (dA & 0xff);
  m.mem8[wholeSecond(m)] = m.mem8[wholeSecond(m)] + (dB >> 8);
  m.mem8[fractionSecond(m)] = m.mem8[fractionSecond(m)] + (dB & 0xff);
}

/** BUG: moves the first coordinate and forgets the second one entirely. */
function brokenSecondSkipped(m) {
  const [first] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[WORLD_SCROLL_Y] + first);
}

/**
 * Per twin: the headings it SURVIVES over the sweep, its exact catch count over the crafted
 * cross, whether the real dispatch can see it, and its catch count in each session. Every number
 * is measured, and asserted as a partition or an equality rather than as "more than none", so a
 * twin caught on the WRONG set fails as loudly as one that is not caught at all.
 */
const TWINS = [
  ["no-op", brokenNoOp, [], 1620, true, [1149, 2168, 112]],
  ["forwards-the-pointer", brokenForwardsPointer, [], 1620, true, [1149, 2168, 112]],
  ["other-table-5e00", (m) => flyAlongHeading(m, OTHER_TABLES[0]), [], 1620, true, [1149, 2168, 112]],
  ["other-table-2e3e", (m) => flyAlongHeading(m, OTHER_TABLES[1]), [], 1620, true, [1149, 2168, 112]],
  ["other-table-08fa", (m) => flyAlongHeading(m, OTHER_TABLES[2]), [], 1620, true, [1149, 2168, 112]],
  ["off-by-one-entry", brokenOffByOneEntry, [127, 191], 1620, true, [1145, 2155, 112]],
  ["low-byte-only", brokenLowByteOnly, [], 1620, true, [1149, 2168, 112]],
  ["scroll-only", brokenScrollOnly, [], 1620, true, [1149, 2168, 112]],
  ["heading-only", brokenHeadingOnly, [], 1600, true, [1149, 2168, 112]],
  ["axes-swapped", brokenAxesSwapped, [], 1620, true, [1149, 2168, 112]],
  ["no-carry", brokenNoCarry, everyHeading, 1189, false, [857, 1387, 90]],
  ["second-skipped", brokenSecondSkipped, [0, 127, 128, 131, 255], 1530, false, [802, 2108, 112]],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: flyAtSlowestSpeed == oracle on RAM", { skip }, () => {
  const r = gate(flyAtSlowestSpeed);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  EQUAL: entry heading ${headingOf(e)} bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} ` +
      `holding ${hex4(e.regs.hl)} within ${ENTRY_FRAMES} frames; RAM identical`,
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
  flyAtSlowestSpeed(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !MOVED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register outside the excluded set diverged: nothing beyond the scratch registers and " +
      "the stack pointer may differ, and the pair carrying the second component must agree " +
      "on both arms",
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
    return flyAtSlowestSpeed(m);
  }, { maxFrames: 2 * ENTRY_FRAMES });
  assert.notEqual(later, null, "vacuous: the doubled budget never reached the routine");
  assert.equal(headingOf(later), headingOf(first), "a longer run must not change the entry");
  assert.equal(later.regs.ix, first.regs.ix, "nor which object slot it came from");
  console.log(
    `  DEAD FIRST DISPATCH: heading ${headingOf(first)} at ${hex4(first.regs.ix)} on both ` +
      "budgets — only crafting escapes it",
  );
});

test("DEGENERATE ENTRY: the second coordinate is inert and no fraction carries", { skip }, () => {
  const e = entryState();
  const [first, second] = componentsOf(e);
  assert.equal(second, 0, "the entry's second component is expected to be zero");
  assert.equal(e.mem16[WORLD_SCROLL_X], 0, "and so is the second displacement cell");
  assert.notEqual(first, 0, "the first component is not, which is what keeps the arm above alive");
  assert.equal(e.mem8[fractionFirst(e)], 0, "both fractions are zero here, so nothing can carry");
  assert.equal(e.mem8[fractionSecond(e)], 0, "both fractions are zero here, so nothing can carry");

  const after = e.clone();
  oracle(after);
  const stationary = WRITTEN.filter((at) => e.mem8[at(e)] === after.mem8[at(after)]);
  assert.equal(stationary.length, 2, "exactly the second coordinate's two bytes must stand still");
  console.log(
    `  DEGENERATE: components ${first}/${second}, displacements ` +
      `${hex4(e.mem16[WORLD_SCROLL_Y])}/${hex4(e.mem16[WORLD_SCROLL_X])}; two written bytes inert`,
  );
});

test("UNIFORM CORPUS: the shared tape skips a band, and no tape can vary the table", { skip }, () => {
  const seen = sessions();
  assert.equal(seen.length, TAPES.length, "vacuous: a session is missing from the corpus");
  for (const s of seen) {
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
  }
  const shared = seen.find((s) => s.label === "shared");
  const turning = seen.find((s) => s.label === "turning");

  const missing = everyHeading.filter((h) => !shared.headings.has(h));
  assert.deepEqual(
    missing,
    everyHeading.slice(22, 114),
    "the band the shared tape misses moved, so the crafted sweep is covering the wrong hole",
  );
  assert.ok(missing.every((h) => turning.headings.has(h)), "the wider tape must contain the band");
  assert.equal(turning.headings.size, HEADINGS, "walking the stick round must cover the circle");

  // The pointer the caller holds is real input, and it is never the one the routine substitutes —
  // which is what stops the forwards-the-pointer twin from being blind on a real dispatch.
  const pointers = new Set(seen.flatMap((s) => [...s.pointers]));
  assert.ok(pointers.size > 0, "vacuous: no dispatch recorded an incoming pointer");
  assert.ok(
    !pointers.has(VELOCITY_TABLE),
    "a caller now arrives already holding the fixed table, so forwarding it is invisible there",
  );

  // The stated hole: the crafted arms vary the values read, never the bases they are read from.
  const bases = new Set(seen.flatMap((s) => [...s.bases]));
  assert.equal(bases.size, 6, "the number of record bases real play presents moved");
  console.log(
    `  UNIFORM CORPUS: ${seen.map((s) => `${s.label} ${s.dispatches}/${s.headings.size}`).join(", ")} ` +
      `(dispatches/headings); shared misses ${missing.length}; incoming pointers ` +
      `${[...pointers].map(hex4).join(",")}; ${bases.size} record bases`,
  );
});

test("CORPUS: every dispatch of three real sessions replays identically", { skip }, () => {
  const seen = sessions();
  let total = 0;
  for (const s of seen) {
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} session never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  console.log(`  CORPUS: ${total} real dispatches over three sessions, RAM identical on each`);
});

test("EXHAUSTIVE: 256 headings crafted off the real entry are identical", { skip }, () => {
  let swept = 0;
  for (const heading of everyHeading) {
    const d = unitDiff(flyAtSlowestSpeed, selector(heading));
    assert.equal(d, null, `heading ${heading}: ${show(d)}`);
    swept++;
  }
  assert.equal(swept, HEADINGS, "the sweep did not cover the whole circle");
  console.log(`  EXHAUSTIVE: ${swept} headings identical, the band no tape drives included`);
});

test("CRAFTED: every displacement x position x heading combination is identical", { skip }, () => {
  for (const [heading, p] of cross()) {
    const d = unitDiff(flyAtSlowestSpeed, craft(heading, p));
    assert.equal(d, null, `heading ${heading} ${JSON.stringify(p)}: ${show(d)}`);
  }
  const expected = CRAFT_HEADINGS.length * SCROLLS.length ** 2 * POSITIONS.length;
  assert.equal(cross().length, expected, "the crafted cross shrank");
  console.log(`  CRAFTED: ${cross().length} entries identical`);
});

test("CARRY: a fraction swept 0..255 carries into the whole byte as the oracle does", { skip }, () => {
  const priors = carryPriors();
  assert.ok(priors.length > 0, "vacuous: the carry sweep is empty");
  for (const p of priors) {
    const d = unitDiff(flyAtSlowestSpeed, craft(0, p));
    assert.equal(d, null, `fraction=${p.fA}: ${show(d)}`);
  }
  const caught = priors.filter((p) => unitDiff(brokenNoCarry, craft(0, p)) !== null).length;
  assert.equal(caught, 255, "the carry sweep stopped discriminating the lost-carry twin");
  console.log(`  CARRY: ${priors.length} fractions identical; the lost-carry twin dies on ${caught}`);
});

test("THE INCOMING POINTER IS IGNORED: forcing it hostile leaves no trace", { skip }, () => {
  const r = hostileSession((mm) => {
    mm.regs.hl = OTHER_TABLES[0];
    return oracle(mm);
  });
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped})`);
  assert.equal(r.frames, CORPUS_FRAMES, `compared ${r.frames} of ${CORPUS_FRAMES} frames`);
  assert.ok(r.dispatches > 0, "vacuous: the instrument never reached the routine");
  assert.equal(r.cells, 0, "the pointer a caller holds reached game memory, so this entry does " +
    "NOT override it and the whole reading of the file is wrong");
  console.log(
    `  IGNORED: a different table forced in before all ${r.dispatches} dispatches over ` +
      `${r.frames} frames, no trace`,
  );
});

test("LIVE-OUT IS MEMORY-ONLY: every register left behind steers nothing", { skip }, () => {
  const r = hostileSession((mm) => {
    const v = oracle(mm);
    for (const k of LEFT_BEHIND) mm.regs[k] = k.length === 1 ? 0x5a : 0x5a5a;
    return v;
  });
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped})`);
  assert.equal(r.frames, CORPUS_FRAMES, `compared ${r.frames} of ${CORPUS_FRAMES} frames`);
  assert.ok(r.dispatches > 0, "vacuous: the instrument never reached the routine");
  assert.equal(r.cells, 0, "a hostile value in a register the rewrite does not promise reached " +
    "game memory: some caller CONSUMES it and the live-out claim is wrong");
  console.log(
    `  LIVE-OUT: ${LEFT_BEHIND.join(", ")} forced hostile after all ${r.dispatches} dispatches ` +
      `over ${r.frames} frames, no trace`,
  );
});

test("TEETH: the two hostile instruments are WIRED — a real input forks the run", { skip }, () => {
  const viaObject = hostileSession((mm) => {
    mm.regs.ix = (mm.regs.ix + 16) & 0xffff;
    return oracle(mm);
  });
  const viaSprite = hostileSession((mm) => {
    mm.regs.iy = (mm.regs.iy + 2) & 0xffff;
    return oracle(mm);
  });
  assert.ok(viaObject.cells > 0, "moving the object base left the machine identical, so the two " +
    "arms above never reach the routine and prove nothing");
  assert.ok(viaSprite.cells > 0, "moving the sprite base left the machine identical, so the two " +
    "arms above never reach the routine and prove nothing");
  console.log(
    `  TEETH/instruments: the object base forks ${viaObject.cells} cells, the sprite base ` +
      `${viaSprite.cells}`,
  );
});

test("EXHAUSTIVE: the shim charges exactly what the oracle charges", { skip }, () => {
  for (const heading of everyHeading) {
    const m = selector(heading);
    const predicted = oracleTStates(m);
    const before = m.cycles;
    oracle(m);
    assert.equal(m.cycles - before, predicted, `heading ${heading}: the shim total is wrong`);
  }
  console.log("  EXHAUSTIVE: the shim's T-state total matches the oracle on every heading");
});

test("WHOLE-MACHINE: driven play is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(flyAtSlowestSpeed);
  const fired = w.invocations.get(TARGET);
  assert.ok(fired > 0, "vacuous: the override never dispatched in this many frames");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${fired} dispatches, RAM identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, survives, crossCaught, caughtAtDispatch, perSession] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared headings`, { skip }, () => {
    const caught = [];
    const missed = [];
    for (const h of everyHeading) {
      (unitDiff(twin, selector(h)) === null ? missed : caught).push(h);
    }
    assert.deepEqual(missed, survives, `${label}: wrong survivor set over the heading sweep`);
    assert.deepEqual(
      [...caught, ...missed].sort((x, y) => x - y),
      everyHeading,
      "caught and missed must PARTITION the headings, sharing none and omitting none",
    );
    console.log(`  TEETH/${label}: caught on ${caught.length} of ${HEADINGS} headings`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = cross().filter(([h, p]) => unitDiff(twin, craft(h, p)) !== null).length;
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

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = TAPES.map(([, opts]) => replaySession(opts, twin));
    for (const [i, r] of counts.entries()) {
      assert.ok(r.dispatches > 0, `vacuous: the ${TAPES[i][0]} session never dispatched`);
      assert.equal(r.dispatches, DISPATCHES[TAPES[i][0]], "the session's dispatch count moved");
      assert.equal(r.caught, perSession[i], `the ${label} twin's ${TAPES[i][0]} catch count moved`);
    }
    assert.ok(
      counts.some((r) => r.caught > 0),
      `every real session PASSED the ${label} twin — only crafted entries catch it`,
    );
    console.log(`  TEETH/${label}: real sessions catch ${counts.map((r) => r.caught).join("/")}`);
  });

  test(`TEETH: the ${label} twin FORKS the whole machine`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(w.equal, false, `the ${label} twin ran clean — the replay has no teeth`);
    console.log(`  TEETH/${label}: forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  });
}
