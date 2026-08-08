// SPDX-License-Identifier: GPL-3.0-only
/**
 * runSceneryForEra — memory-equivalent to the frozen oracle at ROM 0x2CBC.
 *
 * GATE: unit-capture judged by a MASKED RAM diff, a replayed corpus of every dispatch from two
 *   sessions, and a crafted sweep that forces each of the three running orders in turn.
 *
 *   THE EXCLUSION is the dead stack scratch, and here it is LARGER than a single return slot
 *   because most of the steps are now direct calls that push nothing where the frozen routine
 *   pushed a slot for each. The window is exactly [SP-6, SP) and every arm PINS it — each walks
 *   the whole dump and asserts no divergence escapes it, so it cannot quietly widen.
 *
 *   ONE STEP STILL LEAVES THROUGH A RETURN. The rewrite lays a slot down for that one, and the
 *   arm below MEASURES what happens without it: the stack pointer ends two bytes adrift per
 *   dispatch, so the slot is not decoration.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — identical outside the six-byte window.
 *   2. NOT VACUOUS — an empty candidate FAILS the same masked comparison.
 *   3. SEATS THE CURSORS — both are set here from constants, whatever the caller held, which is
 *      asserted from a poisoned pair so it cannot pass by agreeing on an unwritten register.
 *   4. CORPUS — every dispatch of a driven and an undriven session, counts asserted, together
 *      with WHICH eras those sessions present. They present one each, and different ones.
 *   5. EXCLUDED — the register divergence BOUNDED by a measured set: a register diverging outside
 *      it fails the arm, and a rewrite that diverges on fewer of them still passes.
 *   6. CRAFTED — the era index forced to each of 0..7 and to 255, so all three orders run,
 *      including the one an index past the last era falls to.
 *   7. THE PARKED SLOT IS LOAD-BEARING — measured, not argued.
 *   8. TEETH — six twins, each caught on an exact count of the crafted eras. Two score below
 *      nine, which is the family reporting its own shape: a twin that gets ONE era's order wrong
 *      can only be caught on the eras that take that order.
 *
 * HOLE: THE LAST ERA'S ORDER IS CRAFTED-ONLY. Neither session ever reaches it, which the corpus
 * arm asserts, so everything this file says about that order rests on a poked era index rather
 * than on a state the game drove itself to.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2cbc.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { runSceneryForEra } from "../runSceneryForEra.js";
import { driftThreeTileSceneryAtFiveQuarters } from "../driftThreeTileSceneryAtFiveQuarters.js";
import { stepTwoTileSceneryAtFiveQuarters } from "../stepTwoTileSceneryAtFiveQuarters.js";
import { driftTwoTileSceneryAtThreeQuarters } from "../driftTwoTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtThreeQuarters } from "../driftOneTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtHalf } from "../driftOneTileSceneryAtHalf.js";
import { ERA_INDEX } from "../names.js";
import { loc_2cbc as oracle } from "../../translated/loc_2cbc.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2cbc;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const SCRATCH_BYTES = 6;
const FIRST_RECORD = 0xa900;
const FIRST_ENTRY = 0xaa30;
const FIRST_ERA = 0;
const LAST_ERA = 4;
const DIAGONAL_PAIR = 0x2d21;
const AFTER_DIAGONAL_PAIR = 0x2cd1;

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 1386, attract: 1102 };
/** The eras each session presents. Measured, and asserted, because they differ and are single. */
const REAL_ERAS = { shared: [0], attract: [1] };

const ERAS = [0, 1, 2, 3, 4, 5, 6, 7, 255];
const EXCLUDED = ["a", "f", "e", "sp"];
/** A cursor value the routine must overwrite, so the seating arm cannot pass vacuously. */
const POISON = 0x1234;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry, and the masked comparison ────────────────────────────────────────────────

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
  if (entry === null) gate(runSceneryForEra);
  return entry;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/**
 * Masked RAM, then the two cursors the band leaves standing. A candidate that DIES where the
 * frozen routine survives is a divergence too, and the twin that never seats fails that way.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "survived", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  if (a.regs.ix !== b.regs.ix) return { addr: null, a: a.regs.ix, b: b.regs.ix };
  if (a.regs.iy !== b.regs.iy) return { addr: null, a: a.regs.iy, b: b.regs.iy };
  return null;
}

function craft(era) {
  const m = entryState().clone();
  m.mem8[ERA_INDEX] = era;
  m.regs.ix = POISON;
  m.regs.iy = POISON;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const era of ERAS) if (unitDiff(candidate, craft(era))) caught++;
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const eras = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      eras.add(mm.mem8[ERA_INDEX]);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, eras };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, runSceneryForEra) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

function diagonalPair(m) {
  m.push16(AFTER_DIAGONAL_PAIR);
  m.call(DIAGONAL_PAIR);
}

const OPENING = [driftThreeTileSceneryAtFiveQuarters, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const MIDDLE = [diagonalPair, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const CLOSING = [stepTwoTileSceneryAtFiveQuarters, stepTwoTileSceneryAtFiveQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf, driftOneTileSceneryAtHalf];

function band(m, order, { seat = true } = {}) {
  if (seat) {
    m.regs.ix = FIRST_RECORD;
    m.regs.iy = FIRST_ENTRY;
  }
  for (const step of order) step(m);
}

const orderFor = (era) => (era === FIRST_ERA ? OPENING : era === LAST_ERA ? CLOSING : MIDDLE);

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the cursors are left wherever the caller had them. */
function brokenDoesNotSeat(m) {
  band(m, orderFor(m.mem8[ERA_INDEX]), { seat: false });
}

/** BUG: the first era runs the order everything between the ends runs. */
function brokenFirstEraUsesTheMiddle(m) {
  band(m, m.mem8[ERA_INDEX] === LAST_ERA ? CLOSING : MIDDLE);
}

/** BUG: an era past the last falls to the last era's order instead of the middle one. */
function brokenPastTheLastFallsToTheEnd(m) {
  const era = m.mem8[ERA_INDEX];
  band(m, era === FIRST_ERA ? OPENING : era >= LAST_ERA ? CLOSING : MIDDLE);
}

/** BUG: the last step of every order is dropped. */
function brokenDropsTheLastStep(m) {
  band(m, orderFor(m.mem8[ERA_INDEX]).slice(0, -1));
}

/** BUG: one extra step, so the band runs a slot too far. */
function brokenRunsOneStepTooMany(m) {
  band(m, [...orderFor(m.mem8[ERA_INDEX]), driftOneTileSceneryAtHalf]);
}

/** BUG: the slot the transferred step returns through is never laid down. */
function brokenDropsTheParkedSlot(m) {
  const era = m.mem8[ERA_INDEX];
  const order = era === FIRST_ERA ? OPENING
    : era === LAST_ERA ? CLOSING
    : [(mm) => mm.call(DIAGONAL_PAIR), driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
  band(m, order);
}

const TWINS = [
  ["no-op", brokenNoOp, 9],
  ["does-not-seat", brokenDoesNotSeat, 9],
  ["first-era-uses-the-middle", brokenFirstEraUsesTheMiddle, 1],
  ["past-the-last-falls-to-the-end", brokenPastTheLastFallsToTheEnd, 4],
  ["drops-the-last-step", brokenDropsTheLastStep, 9],
  ["runs-one-step-too-many", brokenRunsOneStepTooMany, 9],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the six-byte scratch window", { skip }, () => {
  gate(runSceneryForEra);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  runSceneryForEra(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.ix, b.regs.ix, "the record cursor diverged");
  assert.equal(a.regs.iy, b.regs.iy, "the sprite-entry cursor diverged");
  console.log(`  EQUAL: era=${entryState().mem8[ERA_INDEX]} sp=${hex4(sp)}; cursors agree`);
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same masked comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed an empty candidate, so it measures nothing here");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("SEATS THE CURSORS: both are set from constants, from a poisoned pair", { skip }, () => {
  const m = craft(FIRST_ERA);
  assert.equal(m.regs.ix, POISON, "the crafted entry is not poisoned, so this arm proves nothing");
  runSceneryForEra(m);
  assert.notEqual(m.regs.ix, POISON, "the record cursor was never seated");
  assert.notEqual(m.regs.iy, POISON, "the sprite-entry cursor was never seated");
  console.log(`  SEATS: from ${hex4(POISON)} to ${hex4(m.regs.ix)} / ${hex4(m.regs.iy)} after four steps`);
});

test("CORPUS: two sessions, one era each, and not the same one", { skip }, () => {
  let total = 0;
  const eras = new Set();
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.deepEqual([...s.eras], REAL_ERAS[s.label], `the ${s.label} tape's era set moved`);
    for (const e of s.eras) eras.add(e);
    total += s.dispatches;
  }
  assert.ok(!eras.has(LAST_ERA), "a session now reaches the last era, so the order this file " +
    "calls crafted-only is driven after all and the hole must be withdrawn");
  console.log(
    `  CORPUS: ${total} dispatches, identical on each; eras seen ${[...eras].sort().join(",")} — ` +
      "the last era is reached by neither",
  );
});

test("EXCLUDED, deliberately: registers and pc, and the scratch pushes", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  runSceneryForEra(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} and pc`);
});

test("CRAFTED: all three running orders, each forced by an era index", { skip }, () => {
  assert.equal(sweepCaught(runSceneryForEra), 0, "the rewrite diverged somewhere in the crafted space");
  assert.ok(ERAS.includes(LAST_ERA), "vacuous: the crafted eras no longer reach the last order");
  assert.ok(ERAS.some((e) => e > LAST_ERA), "vacuous: no crafted era falls past the last one");
  console.log(`  CRAFTED: eras ${ERAS.join(",")} identical, all three orders reached`);
});

test("THE PARKED SLOT IS LOAD-BEARING: without it the stack pointer drifts", { skip }, () => {
  const middle = craft(1);
  const parked = middle.clone();
  const unparked = middle.clone();
  runSceneryForEra(parked);
  brokenDropsTheParkedSlot(unparked);
  assert.equal(
    unparked.regs.sp - parked.regs.sp,
    2,
    "dropping the parked slot no longer moves the stack pointer, so the rewrite should stop " +
      "laying one down",
  );
  assert.equal(parked.regs.sp, middle.regs.sp, "the parked form must leave the pointer where it " +
    "found it");
  console.log(
    `  PARKED SLOT: with it sp stays ${hex4(parked.regs.sp)}; without it ` +
      `${hex4(unparked.regs.sp)}, two bytes adrift per dispatch`,
  );
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted eras`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${ERAS.length} crafted eras`);
  });
}
