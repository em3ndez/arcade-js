// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_58b6 — memory-equivalent to the frozen oracle at ROM 0x58B6.
 *
 * WHAT IT IS. Two instructions: load a fixed table pointer, then tail-jump to the DOUBLE-VELOCITY
 * per-object move at 0x58FE, which IS ALREADY DECOMPILED — so the rewrite calls
 * flyAlongHeadingAtDoubleVelocity directly with the table as an argument, and dissolving that
 * transfer belongs to this caller's unit. The whole content of the entry is the CHOICE OF TABLE,
 * plus the fact that a pointer the caller was already holding is discarded.
 *
 * ★ THIS ENTRY IS NOT A SIBLING OF THE THREE 0x59Cx SHIMS IT WAS BATCHED WITH, and the difference
 *   is the reason this file looks nothing like theirs. They all share the two-instruction shape,
 *   but this one hands its table to a MOVER, which writes four coordinate bytes and returns
 *   nothing a caller reads; those hand theirs to a LOOKUP, which writes no memory at all and whose
 *   whole product is a register pair. So RAM is a real gate here and is blind there, and the
 *   live-out declared here is memory where theirs is a pair. Reading the four as one shape would
 *   have given this file a register live-out it does not have, or given them a RAM gate that
 *   passes anything.
 *
 * ★ THE LIVE-OUT IS DERIVED FROM THE ORACLE, TWO WAYS, AND BOTH SAY MEMORY ONLY. Statically, the
 *   oracle's two call sites both run a sprite-tile update next and then a two-cell range test, and
 *   neither of those reads a register this entry leaves — one restores the caller's own pair off
 *   the stack, and the loop tail they return into overwrites the rest before reading it.
 *   Empirically, the LIVE-OUT arm forces a, f, bc, de and hl hostile AFTER every one of the real
 *   dispatches in a whole session and the run stays bit-identical, while the tooth beside it shows
 *   the instrument is wired: nudging either record base forks the same session.
 *
 * ★ THE TABLE IS THE ONLY THING THIS ENTRY DECIDES. Six velocity tables sit in the image whose
 *   peak magnitudes climb in even steps — 0x59D7, 0x5C00, 0x5E00, 0x2530, 0x2E3E, 0x08FA. This
 *   entry takes the THIRD rung. The twins hand the same move the rungs either side, both ends of
 *   the ladder, and two pointers that are no table at all; the RUNG LADDER arm reads the peaks and
 *   the steps between them out of memory rather than asserting them from this comment, and
 *   re-derives why a neighbouring rung cannot hide behind a near-zero sample.
 *
 * ★ ONE SESSION REACHES THIS ENTRY AND IT TOOK A POKE TO GET THERE. Undriven attract, the shared
 *   coin-then-start tape, and that tape with the stick walked round the compass each dispatch it
 *   ZERO times. The same turning tape with the era index held at 4 in the once-per-frame service
 *   dispatches it hundreds of times, off a stick the game is really reading. That is an A/B with a
 *   control: ONE cell decides whether the identical tape reaches this routine, and the poke goes
 *   into the frame service rather than into the entry, so the game's own dispatcher chooses.
 *
 * GATE: unit-capture on the era-held session, an exhaustive heading sweep, a crafted cross, a
 *   carry sweep, whole-session hostile-register instruments, and a whole-machine replay. What it
 *   exercises, holes stated:
 *
 *   1. TAPE REACH — the four sessions' dispatch counts, measured and asserted, including the three
 *      zeroes and the control that turns them into hundreds.
 *   2. CONTRACT — unitEquivalence at the first real dispatch: RAM identical.
 *   3. NOT VACUOUS — a no-op candidate FAILS that same RAM diff, so RAM really is the gate here.
 *   4. CORPUS — every dispatch of the era-held session replayed, not a deduplicated sample.
 *   5. UNIFORM CORPUS — the corpus presents ONE record base pair and part of the heading circle;
 *      the numbers are pinned so a move is a finding, and the crafted sweep covers the rest.
 *   6. EXCLUDED — over the whole heading sweep, no register outside the scratch set moves, and the
 *      four written bytes never differ. Stated as a containment rather than as an exact shape, so
 *      a rewrite that agreed on MORE registers would not turn this arm red.
 *   7. EXHAUSTIVE — all 256 headings crafted off the real entry.
 *   8. CRAFTED CROSS — displacements x positions x four headings, poked identically on both sides.
 *   9. CARRY — one fraction swept 0..255, the arm that reaches the carry between a coordinate's
 *      halves; the captured entry cannot reach it on its own.
 *  10. THE INCOMING POINTER IS IGNORED — measured by forcing it to a neighbouring rung BEFORE every
 *      dispatch of a whole session.
 *  11. LIVE-OUT IS MEMORY-ONLY — measured, as described above, with its own positive control.
 *  12. RUNG LADDER — the six peaks and their spacing read out of memory, and the headings at which
 *      a neighbour agrees on ONE sample but never on the perpendicular pair.
 *  13. WHOLE-MACHINE — the era-held session with the rewrite wired, diffed every frame.
 *  14. TEETH — a twin per failure mode, each with an exactly declared survivor set over the heading sweep, an
 *      exact catch count over the crafted cross and over the real session, and a whole-machine fork.
 *
 * The whole-machine replay needs a shim: the host engine is cycle-driven and every path in is a
 * transfer that ends in the move's own return, so a candidate charging no T-states and not taking
 * that return would move the vblank interrupt and leak two stack bytes per dispatch. The total is
 * measured off a clone per dispatch rather than predicted, which makes it exact by construction;
 * what the arm then tests is memory, not timing.
 *
 * HOLE: ONE record base pair in the whole corpus, and the crafted arms vary the values read rather
 * than the bases they are read from. Nothing here speaks for a second object slot.
 * HOLE: the corpus reaches part of the heading circle, not all of it. The exhaustive sweep covers
 * the rest, but only off this one entry's priors.
 * HOLE: one era. Whether some other state reaches this entry with a different object population is
 * not covered, and the three zero rows are "not reached by these tapes", never "unreachable".
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-58b6.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { loc_58b6 } from "../loc_58b6.js";
import { flyAlongHeading } from "../flyAlongHeading.js";
import { flyAlongHeadingAtDoubleVelocity } from "../flyAlongHeadingAtDoubleVelocity.js";
import { ERA_INDEX, WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";
import { loc_58b6 as oracle } from "../../translated/loc_58b6.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x58b6;

/** The one table this entry exists to select, and the ladder it is the third rung of. */
const VELOCITY_TABLE = 0x5e00;
const LADDER = [0x59d7, 0x5c00, 0x5e00, 0x2530, 0x2e3e, 0x08fa];
const PEAKS = [206, 231, 256, 281, 306, 331];
const RUNG = LADDER.indexOf(VELOCITY_TABLE);
const RUNG_BELOW = LADDER[RUNG - 1];
const RUNG_ABOVE = LADDER[RUNG + 1];

/** Where every rung holds the same near-zero sample, so ONE sample cannot tell them apart. */
const ZERO_CROSSINGS = [62, 63, 64, 65, 67, 190, 191, 192, 193];

/** Two malformed pointers: one entry along, and one BYTE along so the samples straddle. */
const OFF_BY_ONE_ENTRY = VELOCITY_TABLE + 2;
const MISALIGNED = VELOCITY_TABLE + 1;

const HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

/** Registers the contract drops. The arm asserts CONTAINMENT in this set, never equality to it. */
const SCRATCH = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 1600;
const ENTRY_BUDGET = 1600;
const RET_TSTATES = 10;

/** The era this entry's caller belongs to. Held in the frame service, never at the entry. */
const HELD_ERA = 4;
const FRAME_SERVICE = 0x0038;

const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const everyHeading = Array.from({ length: HEADINGS }, (_unused, h) => h);

/** The coin-then-start tape with the stick walked round the compass, trigger held. */
function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: 0x10, dur: CORPUS_FRAMES },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
  let frame = TURN_FIRST_FRAME;
  for (let i = 0; i < 60; i++) {
    tape.push({ frame, port: IN1, bits: compass[i % compass.length], dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const frameService = buildRoutines().get(FRAME_SERVICE);

/** The same turning tape, with one cell held in the once-per-frame service and nothing else. */
function eraHeldMachine(overrides) {
  const merged = new Map(overrides ?? []);
  const inner = merged.get(FRAME_SERVICE) ?? frameService;
  merged.set(FRAME_SERVICE, (mm, ...args) => {
    mm.mem8[ERA_INDEX] = HELD_ERA;
    return inner(mm, ...args);
  });
  return makeMachine(merged, { tape: turnTape() });
}

const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const sharedMachine = (overrides) => makeMachine(overrides, {});
const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

const SESSIONS = [
  ["attract", attractMachine],
  ["shared", sharedMachine],
  ["turning", turningMachine],
  ["era-held", eraHeldMachine],
];

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { attract: 0, shared: 0, turning: 0, "era-held": 645 };
const CORPUS_HEADINGS = 50;
const CORPUS_BASES = 1;

const headingOf = (m) => m.mem8[(m.regs.ix + HEADING_CELL) & 0xffff];
const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];
const signedAt = (m, table, index) => {
  const v = sampleAt(m, table, index);
  return v & 0x8000 ? v - 0x10000 : v;
};

// The four bytes the move writes, addressed off the two record bases the caller supplies.
const wholeFirst = (m) => (m.regs.iy + 49) & 0xffff;
const fractionFirst = (m) => (m.regs.ix + 3) & 0xffff;
const wholeSecond = (m) => m.regs.iy & 0xffff;
const fractionSecond = (m) => (m.regs.ix + 5) & 0xffff;
const WRITTEN = [wholeFirst, fractionFirst, wholeSecond, fractionSecond];

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    eraHeldMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_BUDGET },
  );
}

function entryState() {
  if (entry === null) gate(loc_58b6);
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

// Zero, +1, a low-byte-only step, a whole step, a step and a half, both sign extremes, two negatives.
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
      for (const dB of SCROLLS) for (const p of POSITIONS) out.push([heading, { ...p, dA, dB }]);
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

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(factory, candidate) {
  let dispatches = 0;
  let caught = 0;
  const headings = new Set();
  const bases = new Set();
  const pointers = new Set();
  const eras = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      headings.add(headingOf(mm));
      bases.add(`${hex4(mm.regs.ix)}/${hex4(mm.regs.iy)}`);
      pointers.add(mm.regs.hl);
      eras.add(mm.mem8[ERA_INDEX]);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, headings, bases, pointers, eras };
}

let sessionCache = null;
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = SESSIONS.map(([label, factory]) => ({
    label,
    ...replaySession(factory, loc_58b6),
  }));
  return sessionCache;
}

/** The one session that reaches the entry, replayed against a twin. */
const corpus = (candidate) => replaySession(eraHeldMachine, candidate);

// ── whole-session hostile-register instruments ──────────────────────────────────────────

/** Two era-held sessions diffed frame by frame: clean, and one mutated at every dispatch. */
function hostileSession(mutate) {
  const base = eraHeldMachine();
  const baseFrames = base.runFrames(CORPUS_FRAMES);
  let dispatches = 0;
  const host = eraHeldMachine(new Map([[TARGET, (mm) => {
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
  wholeMachineEquivalence(eraHeldMachine, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** The correct split store, so a twin below breaks the DISPLACEMENT rather than the store. */
function store(m, wholeAddr, fractionAddr, displacement) {
  const moved = (m.mem8[wholeAddr] << 8) + m.mem8[fractionAddr] + displacement;
  m.mem8[wholeAddr] = moved >> 8;
  m.mem8[fractionAddr] = moved;
}

const componentsOf = (m) => [
  sampleAt(m, VELOCITY_TABLE, headingOf(m)),
  sampleAt(m, VELOCITY_TABLE, headingOf(m) - QUARTER),
];

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: uses the pointer the caller happened to be holding instead of overriding it. */
function brokenForwardsPointer(m) {
  flyAlongHeadingAtDoubleVelocity(m, m.regs.hl);
}

/** BUG: the single-velocity move — the near-identical body this entry does NOT reach. */
function brokenSingleVelocity(m) {
  flyAlongHeading(m, VELOCITY_TABLE);
}

/** BUG: doubles the shared drift along with the velocity, so the world moves twice. */
function brokenScrollDoubledToo(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), 2 * (m.mem16[WORLD_SCROLL_Y] + first));
  store(m, wholeSecond(m), fractionSecond(m), 2 * (m.mem16[WORLD_SCROLL_X] + second));
}

/** BUG: the pointer is off by a single entry, so every heading reads its neighbour. */
function brokenOffByOneEntry(m) {
  flyAlongHeadingAtDoubleVelocity(m, OFF_BY_ONE_ENTRY);
}

/** BUG: the pointer is off by one BYTE, so each sample straddles two entries. */
function brokenMisaligned(m) {
  flyAlongHeadingAtDoubleVelocity(m, MISALIGNED);
}

/** BUG: carries the object with the world but never along the heading it points. */
function brokenScrollOnly(m) {
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[WORLD_SCROLL_Y]);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[WORLD_SCROLL_X]);
}

/** BUG: flies the object but pins it to the world instead of letting the world stream past. */
function brokenHeadingOnly(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), 2 * first);
  store(m, wholeSecond(m), fractionSecond(m), 2 * second);
}

/** BUG: each coordinate gets the other coordinate's component. */
function brokenAxesSwapped(m) {
  const [first, second] = componentsOf(m);
  store(m, wholeFirst(m), fractionFirst(m), m.mem16[WORLD_SCROLL_Y] + 2 * second);
  store(m, wholeSecond(m), fractionSecond(m), m.mem16[WORLD_SCROLL_X] + 2 * first);
}

/** BUG: adds each half of a displacement to its own byte, so a fraction overflow never banks. */
function brokenNoCarry(m) {
  const [first, second] = componentsOf(m);
  const dA = (m.mem16[WORLD_SCROLL_Y] + 2 * first) & 0xffff;
  const dB = (m.mem16[WORLD_SCROLL_X] + 2 * second) & 0xffff;
  m.mem8[wholeFirst(m)] = m.mem8[wholeFirst(m)] + (dA >> 8);
  m.mem8[fractionFirst(m)] = m.mem8[fractionFirst(m)] + (dA & 0xff);
  m.mem8[wholeSecond(m)] = m.mem8[wholeSecond(m)] + (dB >> 8);
  m.mem8[fractionSecond(m)] = m.mem8[fractionSecond(m)] + (dB & 0xff);
}

const NO_CARRY_SURVIVORS = [
  41, 42, 61, 80, 115, 116, 117, 118, 137, 138, 139, 140, 175, 194, 213, 214,
];

/** label, twin, headings it survives, catches over the cross, catches over the real session. */
const TWINS = [
  ["no-op", brokenNoOp, [], 1620, 645],
  ["forwards-the-pointer", brokenForwardsPointer, [], 1620, 645],
  ["single-velocity", brokenSingleVelocity, [], 1620, 645],
  ["scroll-doubled-too", brokenScrollDoubledToo, [], 1600, 645],
  ["rung-below", (m) => flyAlongHeadingAtDoubleVelocity(m, RUNG_BELOW), [], 1620, 645],
  ["rung-above", (m) => flyAlongHeadingAtDoubleVelocity(m, RUNG_ABOVE), [], 1620, 645],
  ["bottom-rung", (m) => flyAlongHeadingAtDoubleVelocity(m, LADDER[0]), [], 1620, 645],
  ["top-rung", (m) => flyAlongHeadingAtDoubleVelocity(m, LADDER[5]), [], 1620, 645],
  ["off-by-one-entry", brokenOffByOneEntry, [127, 191], 1620, 645],
  ["misaligned-by-a-byte", brokenMisaligned, [], 1620, 645],
  ["scroll-only", brokenScrollOnly, [], 1620, 645],
  ["heading-only", brokenHeadingOnly, [], 1600, 645],
  ["axes-swapped", brokenAxesSwapped, [], 1620, 645],
  ["no-carry", brokenNoCarry, NO_CARRY_SURVIVORS, 995, 484],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("TAPE REACH: three tapes never reach this entry; one held cell turns that around", { skip }, () => {
  const seen = sessions();
  console.log(`  TAPE REACH (measured): ${seen.map((s) => `${s.label} ${s.dispatches}`).join(", ")}`);
  for (const s of seen) assert.equal(s.dispatches, DISPATCHES[s.label], `${s.label} count moved`);
  const held = seen.find((s) => s.label === "era-held");
  assert.ok(held.dispatches > 0, "vacuous: no session reaches the routine at all");
  assert.deepEqual([...held.eras], [HELD_ERA], "the control cell did not stay held");
});

test("CONTRACT: unitEquivalence at the first real dispatch, RAM identical", { skip }, () => {
  const r = gate(loc_58b6);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  CONTRACT: entry heading ${headingOf(e)} bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} ` +
      `holding ${hex4(e.regs.hl)}; RAM identical`,
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the same RAM diff", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the RAM diff passed a candidate that does nothing, so RAM is NOT " +
    "this gate and every arm resting on it must be re-derived");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("CORPUS: every dispatch of the era-held session replays identically", { skip }, () => {
  const held = sessions().find((s) => s.label === "era-held");
  assert.equal(held.caught, 0, `the rewrite diverged on ${held.caught} real dispatches`);
  console.log(`  CORPUS: ${held.dispatches} real dispatches, RAM identical on each`);
});

test("UNIFORM CORPUS: one record base pair, part of the heading circle", { skip }, () => {
  const held = sessions().find((s) => s.label === "era-held");
  console.log(
    `  UNIFORM CORPUS (measured): bases ${[...held.bases].join(",")}; ` +
      `${held.headings.size} of ${HEADINGS} headings; ${held.pointers.size} incoming pointers`,
  );
  assert.equal(held.bases.size, CORPUS_BASES, "the number of record bases real play presents moved");
  assert.equal(held.headings.size, CORPUS_HEADINGS, "the heading variety real play presents moved, " +
    "so the crafted sweep is covering a different hole from the one this file records");
  for (const table of LADDER) {
    assert.ok(!held.pointers.has(table), `a caller now arrives holding ${hex4(table)}, so forwarding hides`);
  }
});

test("EXCLUDED, deliberately: nothing outside the scratch set moves, over the whole sweep", { skip }, () => {
  const moved = new Set();
  for (const heading of everyHeading) {
    const a = selector(heading);
    const b = a.clone();
    oracle(a);
    loc_58b6(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    for (const at of WRITTEN) assert.equal(a.mem8[at(a)], b.mem8[at(b)], `live-out ${hex4(at(a))}`);
  }
  const measured = REG_FIELDS.filter((k) => moved.has(k));
  console.log(`  EXCLUDED (measured): ${measured.join(", ")}`);
  assert.deepEqual(measured.filter((k) => !SCRATCH.includes(k)), [], "a register outside the " +
    "scratch set moved, so the contract this file gates on no longer describes the rewrite");
});

test("EXHAUSTIVE: all 256 headings crafted off the real entry are identical", { skip }, () => {
  for (const heading of everyHeading) {
    const d = unitDiff(loc_58b6, selector(heading));
    assert.equal(d, null, `heading ${heading}: ${show(d)}`);
  }
  console.log(`  EXHAUSTIVE: ${HEADINGS} headings identical`);
});

test("CRAFTED: every displacement x position x heading combination is identical", { skip }, () => {
  for (const [heading, p] of cross()) {
    const d = unitDiff(loc_58b6, craft(heading, p));
    assert.equal(d, null, `heading ${heading} ${JSON.stringify(p)}: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${cross().length} entries identical`);
});

test("CARRY: a fraction swept 0..255 carries into the whole byte as the oracle does", { skip }, () => {
  const priors = carryPriors();
  for (const p of priors) {
    const d = unitDiff(loc_58b6, craft(0, p));
    assert.equal(d, null, `fraction=${p.fA}: ${show(d)}`);
  }
  const caught = priors.filter((p) => unitDiff(brokenNoCarry, craft(0, p)) !== null).length;
  console.log(`  CARRY (measured): the lost-carry twin dies on ${caught} of ${priors.length}`);
  assert.ok(caught > 0, "the carry sweep stopped discriminating the lost-carry twin");
});

test("THE INCOMING POINTER IS IGNORED: forcing it hostile leaves no trace", { skip }, () => {
  const r = hostileSession((mm) => {
    mm.regs.hl = RUNG_BELOW;
    return oracle(mm);
  });
  assert.equal(r.stopped, null, `a run stopped early (${r.stopped})`);
  assert.equal(r.frames, CORPUS_FRAMES, `compared ${r.frames} of ${CORPUS_FRAMES} frames`);
  assert.ok(r.dispatches > 0, "vacuous: the instrument never reached the routine");
  assert.equal(r.cells, 0, "the pointer a caller holds reached game memory, so this entry does " +
    "NOT override it and the whole reading of the file is wrong");
  console.log(
    `  IGNORED: a neighbouring table forced in before all ${r.dispatches} dispatches over ` +
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

test("TEETH: the hostile instruments are WIRED — a real input forks the run", { skip }, () => {
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

test("RUNG LADDER: the peaks step evenly and no heading hides a neighbour", { skip }, () => {
  const m = entryState();
  const peaks = LADDER.map((t) => Math.max(...everyHeading.map((h) => Math.abs(signedAt(m, t, h)))));
  const steps = peaks.slice(1).map((p, i) => p - peaks[i]);
  console.log(`  RUNG LADDER (measured): peaks ${peaks.join("/")}, steps ${steps.join("/")}`);
  assert.deepEqual(peaks, PEAKS, "the ladder of peak magnitudes moved");
  assert.deepEqual(steps, [25, 25, 25, 25, 25], "the rungs stopped being evenly spaced");
  assert.equal(RUNG, 2, "this entry stopped being the third rung of the ladder");
  for (const neighbour of [RUNG_BELOW, RUNG_ABOVE]) {
    const oneAgrees = everyHeading.filter(
      (h) => sampleAt(m, VELOCITY_TABLE, h) === sampleAt(m, neighbour, h),
    );
    assert.deepEqual(oneAgrees, ZERO_CROSSINGS, `${hex4(neighbour)}: the agreeing headings moved`);
    const bothAgree = oneAgrees.filter(
      (h) => sampleAt(m, VELOCITY_TABLE, h - QUARTER) === sampleAt(m, neighbour, h - QUARTER),
    );
    assert.deepEqual(bothAgree, [], `${hex4(neighbour)} matches on BOTH samples somewhere, so ` +
      "those headings cannot discriminate it and the twin's survivor list must record them");
  }
});

test("WHOLE-MACHINE: the era-held session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(loc_58b6);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches, identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, survives, crossCaught, sessionCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared entries`, { skip }, () => {
    const missed = everyHeading.filter((h) => unitDiff(twin, selector(h)) === null);
    const caught = cross().filter(([h, p]) => unitDiff(twin, craft(h, p)) !== null).length;
    console.log(
      `  TEETH/${label}: ${HEADINGS - missed.length} of ${HEADINGS} headings, ${caught} of ` +
        `${cross().length} crafted; survivors [${missed.join(",")}]`,
    );
    assert.deepEqual(missed, survives, `${label}: wrong survivor set over the heading sweep`);
    assert.equal(caught, crossCaught, `the ${label} twin's crafted catch count moved`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const r = corpus(twin);
    console.log(`  TEETH/${label}: the real session catches ${r.caught} of ${r.dispatches}`);
    assert.equal(r.caught, sessionCaught, `the ${label} twin's real catch count moved`);
  });

  test(`TEETH: the whole machine forks on the ${label} twin`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    console.log(
      `  TEETH/${label}: whole machine ${w.equal ? "is BLIND" : `forks at frame ${w.frame}`}`,
    );
    assert.equal(w.equal, false, `the whole machine stopped seeing the ${label} twin`);
  });
}
