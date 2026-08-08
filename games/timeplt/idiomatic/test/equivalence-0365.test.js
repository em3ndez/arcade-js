// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishSpriteShadow — memory-equivalent to the frozen oracle at ROM 0x0365.
 *
 * GATE: strict unit-capture with NO EXCLUSION OF ANY KIND — this routine calls nothing and pushes
 *   nothing, so the whole state dump is compared byte for byte — over a two-tape corpus that
 *   replays every dispatch, plus crafted sweeps of the shadow it reads and of the window that
 *   gates its tail.
 *
 * What it exercises, holes stated:
 *   1. CORPUS — 1165 dispatches per tape, all compared, whole dump, no mask. Counts asserted.
 *   2. THE ORIENTATION SPLIT IS LOPSIDED AND THE TEST SAYS SO. Measured: of those 1165, exactly
 *      ONE has the picture turned round on each tape. So real data barely touches half of what
 *      this routine decides, and the crafted arm below is what covers it.
 *   3. CRAFTED SHADOW — six planted patterns against both orientations. The patterns are chosen so
 *      every one of the four transforms is exercised at its edges: a value that carries out of a
 *      byte when the bias is added, a value already at the top bit, all-ones and all-zeros.
 *   4. THE TAIL'S WINDOW — the phase and the step swept together against TWO shadow patterns, one
 *      that leaves the bit the tail raises clear and one that has it already set, and the set of
 *      pairs that actually move memory read back rather than asserted from the code.
 *   5. IT READS THE THRESHOLD out of the program image rather than carrying it: poking that byte
 *      moves the window, and a twin that bakes the value in is asserted INVISIBLE without the poke
 *      and caught with it.
 *   6. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and bounded by a declared set: nothing
 *      outside it may move. That set is wide — every main register — so the index and shadow
 *      sets are all this arm still has teeth on.
 *   7. TEETH — ten twins, each with its exact catch count on all three arms asserted, ZEROS
 *      INCLUDED, so a twin that is blind somewhere stays recorded as blind there.
 *
 * HOLE: THE TWINS ARE MEASURED ON THE CRAFTED SPACE AND ON THE FIRST HUNDRED DISPATCHES OF EACH
 * TAPE, not on all 2330. Replaying the whole corpus per twin costs a full session each; the
 * rewrite itself IS compared on every dispatch, and the bounded slice is enough to show each twin
 * is visible in real data as well as in crafted data.
 *
 * HOLE: what the two banks MEAN — which half of a sprite is which coordinate, and why turning the
 * picture round complements one and toggles two bits of another — is not decidable from memory
 * equivalence. This gate fixes the gather order, the four transforms and the tail's window.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0365.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { publishSpriteShadow } from "../publishSpriteShadow.js";
import { loc_0365 as oracle } from "../../translated/loc_0365.js";
import { withPokedImage } from "./_soundQueue.js";
import { u8 } from "../../../../core/int.js";
import { SCREEN_UNFLIPPED, SEQUENCE_PHASE, SEQUENCE_SUBSTEP } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x0365;

const SHADOW_FROM = 0xaa10;
const SHADOW_BYTES = 96;
const BANK_0 = 0xb010;
const BANK_1 = 0xb410;
const BANK_BYTES = 48;

const RAISE_PHASE = 3;
const RAISE_STEP_CEILING = 8;
const RAISE_STEP_FLOOR_CELL = 0x0832;
const POKED_FLOOR = 2;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

/** What the two tapes present. Measured; a move here is a finding. */
const DISPATCHES = 1165;
const TURNED_ROUND_DISPATCHES = 1;
const IN_WINDOW = { attract: 501, "coin-start": 786 };
const TWIN_SLICE = 100;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** The whole state dump, unmasked: this routine touches no stack, so nothing needs excluding. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b)[0] ?? null;
}

let entry = null;

function replaySession(opts, candidate, limit = Infinity) {
  const base = buildRoutines();
  const original = base.get(TARGET);
  let dispatches = 0;
  let compared = 0;
  let caught = 0;
  let turnedRound = 0;
  let inWindow = 0;
  const overrides = new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    if (mm.mem8[SCREEN_UNFLIPPED] === 0) turnedRound++;
    const step = mm.mem8[SEQUENCE_SUBSTEP];
    if (
      mm.mem8[SEQUENCE_PHASE] === RAISE_PHASE &&
      step >= mm.mem8[RAISE_STEP_FLOOR_CELL] &&
      step < RAISE_STEP_CEILING
    ) {
      inWindow++;
    }
    if (compared < limit) {
      compared++;
      if (unitDiff(candidate, mm)) caught++;
    }
    return original(mm);
  }]]);
  const m = makeMachine(overrides, opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "session ran short");
  return { dispatches, compared, caught, turnedRound, inWindow };
}

let cache = null;
function sessions() {
  if (!cache) cache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, publishSpriteShadow) }));
  return cache;
}

function entryState() {
  if (entry === null) sessions();
  assert.notEqual(entry, null, "vacuous: neither tape reached the routine");
  return entry;
}

// ── the crafted space ───────────────────────────────────────────────────────────────────────

/**
 * Six shadow patterns. `carries` is the value that takes the larger bias exactly past a byte;
 * `topBit` is already at the top bit, which the tail's test turns on; the ramps put a different
 * value in every cell so a byte published from the wrong place shows up as the wrong value.
 */
const PATTERNS = {
  zeros: () => 0,
  ones: () => 0xff,
  carries: () => 0xf1,
  topBit: () => 0x80,
  ramp: (i) => u8(i + 1),
  reverseRamp: (i) => u8(SHADOW_BYTES - i),
};
const ORIENTATIONS = [0, 1];

function craft(pattern, orientation) {
  const m = entryState().clone();
  m.mem8[SCREEN_UNFLIPPED] = orientation;
  for (let i = 0; i < SHADOW_BYTES; i++) m.mem8[SHADOW_FROM + i] = PATTERNS[pattern](i);
  return m;
}

const CRAFTED = Object.keys(PATTERNS).flatMap((p) => ORIENTATIONS.map((o) => [p, o]));

function craftedCaught(candidate) {
  return CRAFTED.filter(([p, o]) => unitDiff(candidate, craft(p, o))).length;
}

/** The tail's window: every phase the machine uses against every step it could hold. */
const PHASES = [0, 1, 2, 3, 4];
const STEPS = Array.from({ length: 16 }, (_unused, i) => i);

/**
 * TWO shadow patterns, and the pair is load-bearing. Under `ramp` the tail's own test passes and
 * it raises; under `topBit` the bit it would raise is already set and it must leave the byte
 * alone. Sweeping only one of them cannot tell a conditional raise from an unconditional one.
 */
const WINDOW_PATTERNS = ["ramp", "topBit"];
const WINDOW_SIZE = WINDOW_PATTERNS.length * PHASES.length * STEPS.length;

function craftWindow(pattern, phase, step) {
  const m = craft(pattern, 0);
  m.mem8[SEQUENCE_PHASE] = phase;
  m.mem8[SEQUENCE_SUBSTEP] = step;
  return m;
}

function windowCaught(candidate) {
  let caught = 0;
  for (const pattern of WINDOW_PATTERNS) {
    for (const phase of PHASES) {
      for (const step of STEPS) if (unitDiff(candidate, craftWindow(pattern, phase, step))) caught++;
    }
  }
  return caught;
}

/** The (phase, step) pairs at which the tail actually moves a byte, read out of the oracle. */
function pairsThatRaise() {
  const out = [];
  for (const phase of PHASES) {
    for (const step of STEPS) {
      const before = craftWindow("ramp", phase, step);
      const withTail = before.clone();
      oracle(withTail);
      const withoutTail = before.clone();
      withoutTail.mem8[SEQUENCE_PHASE] = 0;
      oracle(withoutTail);
      if (allDiffs(withTail, withoutTail).some((d) => d.addr !== SEQUENCE_PHASE)) {
        out.push(`${phase}/${step}`);
      }
    }
  }
  return out;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("CORPUS: every dispatch of two tapes, whole dump, no exclusion", { skip: SKIP }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES, `the ${s.label} dispatch count moved`);
    assert.equal(s.compared, s.dispatches, "a dispatch went uncompared");
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    assert.equal(s.inWindow, IN_WINDOW[s.label], `the ${s.label} tail-window count moved`);
    total += s.dispatches;
  }
  console.log(
    `  CORPUS: ${total} dispatches over two tapes, identical byte for byte with nothing masked; ` +
      `the tail's window is entered ${Object.values(IN_WINDOW).join(" and ")} times`,
  );
});

test("THE ORIENTATION SPLIT IS LOPSIDED: one turned-round dispatch per tape", { skip: SKIP }, () => {
  for (const s of sessions()) {
    assert.equal(
      s.turnedRound,
      TURNED_ROUND_DISPATCHES,
      `the ${s.label} tape's turned-round dispatch count moved, so the balance of what real data ` +
        "covers and what the crafted arm covers has to be re-derived",
    );
  }
  console.log(
    `  ORIENTATION: ${TURNED_ROUND_DISPATCHES} of ${DISPATCHES} dispatches per tape have the ` +
      "picture turned round — the crafted arm is what covers that half",
  );
});

test("CRAFTED SHADOW: six planted patterns against both orientations", { skip: SKIP }, () => {
  for (const [pattern, orientation] of CRAFTED) {
    const d = unitDiff(publishSpriteShadow, craft(pattern, orientation));
    assert.equal(d, null, `${pattern}/${orientation}: ${show(d)}`);
  }

  // THE PLANT REALLY IS DISCRIMINATING: with a ramp in the shadow, the two orientations publish
  // different bytes into both banks, so a rewrite that ignored the flag could not pass both.
  const upright = craft("ramp", 1);
  const turned = craft("ramp", 0);
  oracle(upright);
  oracle(turned);
  let bank0Differs = 0;
  let bank1Differs = 0;
  for (let i = 0; i < BANK_BYTES; i++) {
    if (upright.mem8[BANK_0 + i] !== turned.mem8[BANK_0 + i]) bank0Differs++;
    if (upright.mem8[BANK_1 + i] !== turned.mem8[BANK_1 + i]) bank1Differs++;
  }
  assert.ok(bank0Differs > 0, "the orientation no longer changes what bank 0 receives");
  assert.ok(bank1Differs > 0, "the orientation no longer changes what bank 1 receives");
  console.log(
    `  CRAFTED SHADOW: ${CRAFTED.length} pattern x orientation entries identical; turning the ` +
      `picture moves ${bank0Differs} bytes of bank 0 and ${bank1Differs} of bank 1`,
  );
});

test("THE TAIL'S WINDOW: phase against step, and which pairs actually move a byte", { skip: SKIP }, () => {
  assert.equal(windowCaught(publishSpriteShadow), 0, "the rewrite diverged somewhere in the window sweep");
  const raising = pairsThatRaise();
  const floor = entryState().mem8[RAISE_STEP_FLOOR_CELL];
  const expected = STEPS.filter((s) => s >= floor && s < RAISE_STEP_CEILING).map((s) => `${RAISE_PHASE}/${s}`);
  assert.deepEqual(raising, expected, "the window the tail fires in moved");
  console.log(
    `  WINDOW: ${WINDOW_SIZE} pattern x phase x step entries identical; the tail moves a ` +
      `byte at ${raising.join(" ")} and nowhere else`,
  );
});

test("IT READS THE THRESHOLD: poking the image moves the window", { skip: SKIP }, () => {
  const floor = entryState().mem8[RAISE_STEP_FLOOR_CELL];
  assert.notEqual(POKED_FLOOR, floor, "the poke must actually change the threshold");
  withPokedImage(entryState(), RAISE_STEP_FLOOR_CELL, POKED_FLOOR, () => {
    const expected = STEPS.filter((s) => s >= POKED_FLOOR && s < RAISE_STEP_CEILING)
      .map((s) => `${RAISE_PHASE}/${s}`);
    assert.deepEqual(pairsThatRaise(), expected, "the oracle ignored the poked threshold");
    assert.equal(windowCaught(publishSpriteShadow), 0, "the rewrite diverged under the poke");
    assert.ok(windowCaught(brokenBakedThreshold) > 0, "the baked-threshold twin survived the poke");
  });
  assert.equal(windowCaught(brokenBakedThreshold), 0, "the baked-threshold twin is caught WITHOUT " +
    "the poke, so its blindness is not what this arm records");
  console.log(
    `  THRESHOLD: the window follows the image byte from ${floor} to ${POKED_FLOOR}, and a twin ` +
      "that bakes it in is invisible until it is poked",
  );
});

test("EXCLUDED, deliberately: registers and pc, and nothing else", { skip: SKIP }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  publishSpriteShadow(b);
  const EXCLUDED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp"];
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved.filter((k) => !EXCLUDED.includes(k)),
    [],
    "a register outside the declared excluded set moved",
  );
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle returns; the rewrite does not");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.deepEqual(allDiffs(a, b), [], "RAM must be identical with nothing masked");
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — every byte of RAM is held`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────

const keep = (byte) => byte;
const complementPast = (bias) => (byte) => u8(~u8(byte + bias));
const toggleTopTwoBits = (byte) => byte ^ 0xc0;
const stepOn = (byte) => u8(byte + 1);

const BANK_0_RUNS = [[0xaa30, 6], [0xaa10, 32], [0xaa36, 10]];
const BANK_1_RUNS = [[0xaa60, 6], [0xaa40, 32], [0xaa66, 10]];
const RAISED_SPRITES = [0, 2, 4, 38, 40, 42, 44, 46];

/** The rewrite's own shape, parameterised so a twin can change exactly one decision. */
function stamp(m, {
  bank0Runs = BANK_0_RUNS,
  bank1Runs = BANK_1_RUNS,
  upright = [[keep, keep], [keep, complementPast(14)]],
  turned = [[complementPast(15), keep], [toggleTopTwoBits, stepOn]],
  sprites = RAISED_SPRITES,
  floor = null,
  testTopBit = true,
} = {}) {
  const { mem8 } = m;
  const [zero, one] = mem8[SCREEN_UNFLIPPED] === 0 ? turned : upright;
  for (const [runs, at, halves] of [[bank0Runs, BANK_0, zero], [bank1Runs, BANK_1, one]]) {
    let slot = 0;
    for (const [from, length] of runs) {
      for (let i = 0; i < length; i++, slot++) {
        mem8[at + slot] = (slot % 2 === 0 ? halves[0] : halves[1])(mem8[from + i]);
      }
    }
  }
  if (mem8[SEQUENCE_PHASE] !== RAISE_PHASE) return;
  const step = mem8[SEQUENCE_SUBSTEP];
  const low = floor === null ? mem8[RAISE_STEP_FLOOR_CELL] : floor;
  if (step < low || step >= RAISE_STEP_CEILING) return;
  for (const sprite of sprites) {
    const second = mem8[BANK_1 + sprite + 1];
    if (testTopBit && (second & 0x80) !== 0) continue;
    mem8[BANK_1 + sprite + 1] = u8(second + 0x80);
    mem8[BANK_0 + sprite] = u8(mem8[BANK_0 + sprite] + 0x80);
  }
}

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: gathers the runs in the order they sit in memory rather than the order the banks want. */
function brokenMemoryOrder(m) {
  stamp(m, {
    bank0Runs: [[0xaa10, 32], [0xaa30, 6], [0xaa36, 10]],
    bank1Runs: [[0xaa40, 32], [0xaa60, 6], [0xaa66, 10]],
  });
}

/** BUG: copies everything straight, whichever way round the picture is. */
function brokenNoTransforms(m) {
  stamp(m, { upright: [[keep, keep], [keep, keep]], turned: [[keep, keep], [keep, keep]] });
}

/** BUG: the two biases are the other way round. */
function brokenSwappedBiases(m) {
  stamp(m, {
    upright: [[keep, keep], [keep, complementPast(15)]],
    turned: [[complementPast(14), keep], [toggleTopTwoBits, stepOn]],
  });
}

/** BUG: the transforms land on the other half of each sprite. */
function brokenSwappedHalves(m) {
  stamp(m, {
    upright: [[keep, keep], [complementPast(14), keep]],
    turned: [[keep, complementPast(15)], [stepOn, toggleTopTwoBits]],
  });
}

/** BUG: turning the picture round leaves the second bank alone. */
function brokenTurnedBankUntouched(m) {
  stamp(m, { turned: [[complementPast(15), keep], [keep, keep]] });
}

/** BUG: the tail raises every sprite instead of the eight it should. */
function brokenRaisesEverySprite(m) {
  stamp(m, { sprites: Array.from({ length: BANK_BYTES / 2 }, (_unused, i) => 2 * i) });
}

/** BUG: the tail raises the top bit whether or not it is already set. */
function brokenRaisesUnconditionally(m) {
  stamp(m, { testTopBit: false });
}

/** BUG: the tail's floor is carried as an immediate instead of read out of the image. */
function brokenBakedThreshold(m) {
  stamp(m, { floor: 5 });
}

/** BUG: the tail runs in every phase. */
function brokenNoPhaseTest(m) {
  const { mem8 } = m;
  const was = mem8[SEQUENCE_PHASE];
  mem8[SEQUENCE_PHASE] = RAISE_PHASE;
  stamp(m);
  mem8[SEQUENCE_PHASE] = was;
}

/**
 * Per twin: how many of the crafted pattern-by-orientation entries, how many of the window
 * entries, and how many of the first hundred dispatches of each tape catch it. Every number is
 * measured and asserted as an equality — the ZEROS included — so a twin caught on the WRONG set
 * fails as loudly as one not caught at all. Four of the rows say something a reader should not
 * miss:
 *
 * `no-op` is caught on SIX of two hundred real dispatches. On almost every frame the banks
 * already hold exactly what republishing would write, so doing nothing is invisible in real data.
 * That is the sharpest reason this file leans on crafted shadows: a corpus arm alone would pass a
 * rewrite that did not run.
 *
 * `memory-order` is blind under the four uniform patterns and under the topBit half of the window
 * sweep, because a reordering of equal bytes is not a reordering of anything.
 *
 * `turned-bank-untouched` is caught on half the crafted entries and on two real dispatches — the
 * one per tape that has the picture turned round.
 *
 * The three tail twins and `baked-threshold` are caught only where the tail can fire: the captured
 * entry is not in the tail's window, so the crafted-shadow arm cannot see them at all, and
 * `baked-threshold` cannot be seen anywhere on a genuine image. The poked arm above is the only
 * thing that catches that one, and it asserts the zero here so the blindness stays recorded.
 */
const TWINS = [
  ["no-op", brokenNoOp],
  ["memory-order", brokenMemoryOrder],
  ["no-transforms", brokenNoTransforms],
  ["swapped-biases", brokenSwappedBiases],
  ["swapped-halves", brokenSwappedHalves],
  ["turned-bank-untouched", brokenTurnedBankUntouched],
  ["raises-every-sprite", brokenRaisesEverySprite],
  ["raises-unconditionally", brokenRaisesUnconditionally],
  ["baked-threshold", brokenBakedThreshold],
  ["no-phase-test", brokenNoPhaseTest],
];

/** Measured catch counts: [crafted of 12, window of 160, corpus slice of 200]. */
const CAUGHT = {
  "no-op": [12, 160, 6],
  "memory-order": [4, 80, 132],
  "no-transforms": [12, 160, 200],
  "swapped-biases": [12, 160, 200],
  "swapped-halves": [12, 160, 200],
  "turned-bank-untouched": [6, 160, 2],
  "raises-every-sprite": [0, 3, 0],
  "raises-unconditionally": [0, 3, 0],
  "baked-threshold": [0, 0, 0],
  "no-phase-test": [0, 12, 0],
};

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exact counts`, { skip: SKIP }, () => {
    const [craftedExpected, windowExpected, corpusExpected] = CAUGHT[label];
    assert.equal(craftedCaught(twin), craftedExpected, `the ${label} crafted count moved`);
    assert.equal(windowCaught(twin), windowExpected, `the ${label} window count moved`);
    const corpus = TAPES.reduce((n, [, opts]) => n + replaySession(opts, twin, TWIN_SLICE).caught, 0);
    assert.equal(corpus, corpusExpected, `the ${label} corpus-slice count moved`);
    console.log(
      `  TEETH/${label}: caught on ${craftedExpected}/${CRAFTED.length} crafted, ` +
        `${windowExpected}/${WINDOW_SIZE} window, ${corpusExpected}/` +
        `${TWIN_SLICE * TAPES.length} corpus-slice entries`,
    );
  });
}
