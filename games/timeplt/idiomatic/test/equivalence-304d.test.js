// SPDX-License-Identifier: GPL-3.0-only
/**
 * displaceByHalf — memory-equivalent to the frozen oracle at ROM 0x304D.
 *
 * GATE: strict unit-capture, a corpus of real dispatches from three tapes, two exhaustive sweeps
 *   of the whole input space, and a whole-machine replay of driven play. RAM ALONE CANNOT GATE
 *   THIS ROUTINE. It writes no memory, so unitEquivalence reports `ram: null` for the correct arm,
 *   for every broken twin, and for a bare no-op. Test 2 asserts exactly that, and it is the
 *   written justification for gating everywhere else on RAM *plus* the declared live-out {h, l}.
 *
 * LIVE-OUT IS DERIVED FROM THE CALLER, not from the instruction sequence. One file calls this
 *   routine, at two sites, and each site does the same three things afterwards: it stores the two
 *   halves of the result to memory, reloads the scratch pair from memory before the next use, and
 *   branches on no flag. So {h, l} is the whole contract and {f, b, c} are dead; the stack pointer
 *   differs only because the oracle takes the Z80 return. Test 5 bounds the divergence to that set
 *   and test 8 is the falsifiable version — a register a caller really consumed would fork the
 *   whole machine.
 *
 * What it exercises, holes stated:
 *   1. CONTRACT — unitEquivalence at the first real dispatch: RAM identical. `equal` is not
 *      asserted; it folds in the register diff this contract deliberately drops.
 *   2. BLIND — the same call passes a no-op. If it ever fails, the routine writes memory after
 *      all and every arm below that leans on the live-out has to be re-derived.
 *   3. DEGENERATE ENTRY — the first dispatch hands the routine a ZERO displacement, so the
 *      halving it exists to do is invisible there and every twin that gets only the halving wrong
 *      survives it. Raising maxFrames cannot help: unitEquivalence clones the FIRST entry.
 *   4. CORPUS — every distinct displacement three tapes produce, each replayed from its own
 *      captured machine: the shared coin -> start tape, the same tape with the stick walked round
 *      the compass, and undriven attract.
 *   5. EXCLUDED — across a whole sweep nothing outside {f, b, c, sp} moves, and the live-out never
 *      moves. The set is an upper BOUND on the divergence, not a measurement of it: a rewrite that
 *      leaves fewer of those registers dirty is strictly better and still passes.
 *   6. EXHAUSTIVE — both inputs swept over all 65536 values, the displacement against a real
 *      coordinate and the coordinate against a real NEGATIVE ODD displacement. Both adjectives
 *      earn their place: sign splits the space in half, and only an odd displacement can show
 *      which way an inexact halving rounds.
 *   7. TEETH — one twin per plausible way to get a halved displacement wrong. Each declares the
 *      EXACT set of inputs it survives and the EXACT number it is caught on, the test asserts
 *      that caught and missed PARTITION each axis, and every survivor set that is not a literal
 *      is re-derived from the ORACLE's own halving rather than from the twin's arithmetic.
 *   8. WHOLE-MACHINE — driven play with the rewrite wired, RAM diffed every frame against the
 *      all-oracle baseline, and every twin caught there too.
 *   9. THE CORPUS IS A WARNING, NOT A REASSURANCE — the shared tape holds one heading for its
 *      whole run and produces two displacements between them, both non-negative, so TWO of the
 *      twins survive a full replay of it byte-for-byte. Asserted, so the day that tape starts
 *      turning this test fails and says which arm stopped being blind.
 *
 * The replay needs a shim, `hosted()`. The host engine is cycle-driven and the caller reaches this
 * routine by a real call, so a candidate that charges no T-states and does not take the Z80 return
 * both moves the vblank interrupt and leaks the pushed return address. The shim pays both,
 * identically for the real arm and for every twin. The oracle is straight-line, so its total is a
 * constant rather than a computation, and an arm below checks it against the oracle.
 *
 * NO STACK-SCRATCH WINDOW IS DRAWN, deliberately. The oracle pushes nothing — it only pops the
 * return its caller pushed — so there is no scratch to exclude and the whole-machine diff covers
 * every byte, the stack included.
 *
 * HOLE: the corpus is keyed on the DISPLACEMENT alone. Coordinates are not enumerated, because
 * every dispatch carries a different one; the coordinate axis is covered by its own exhaustive
 * sweep instead, from a real captured machine.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-304d.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { displaceByHalf } from "../displaceByHalf.js";
import { loc_304d as oracle } from "../../translated/loc_304d.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x304d;

const WIDTH = 65536;
const NEGATIVE_FROM = WIDTH / 2;

const LIVE_OUT = ["h", "l"];
const EXCLUDED = ["f", "b", "c", "sp"];

const CORPUS_FRAMES = 1500;
const WHOLE_FRAMES = 1400;

/** T-states the oracle charges in total, and the part of that its return costs. */
const ORACLE_TSTATES = 64;
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

const skip = romsPresent() ? false : "ROM images absent";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const signed = (v) => (v << 16) >> 16;
const everyValue = Array.from({ length: WIDTH }, (_unused, v) => v);

/**
 * The shared tape, plus the stick walked once round the compass. Without it the plane holds one
 * heading for the whole run, the world scrolls one way only, and the displacement this routine
 * halves is never negative in play.
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

/** One pristine machine per distinct displacement, over all three tapes. */
function captureCorpus() {
  if (corpus) return corpus;
  const byDisplacement = new Map();
  const perTape = [];
  for (const [label, opts] of TAPES) {
    let dispatches = 0;
    const seen = new Set();
    const m = makeMachine(
      new Map([[TARGET, (mm) => {
        dispatches++;
        seen.add(mm.regs.hl);
        if (!byDisplacement.has(mm.regs.hl)) byDisplacement.set(mm.regs.hl, mm.clone());
        return oracle(mm);
      }]]),
      opts,
    );
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `${label} capture stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, `${label} capture ran short`);
    const negative = [...seen].filter((d) => d >= NEGATIVE_FROM).length;
    perTape.push({ label, dispatches, distinct: seen.size, negative });
  }
  corpus = { entries: [...byDisplacement.values()], displacements: [...byDisplacement.keys()], perTape };
  return corpus;
}

const anEntry = () => captureCorpus().entries[0];

/**
 * The most negative ODD displacement the tapes produced — what the coordinate sweep is held at.
 * Negative because half the space is, and odd because an even displacement halves exactly and
 * hides every rounding error a twin can make.
 */
function realNegativeOdd() {
  const found = captureCorpus().displacements.filter((d) => d >= NEGATIVE_FROM && d % 2 === 1);
  assert.ok(found.length > 0, "no tape produced a negative odd displacement — the sweep is blind");
  return found.reduce((worst, d) => (signed(d) < signed(worst) ? d : worst));
}

// ── the comparison ──────────────────────────────────────────────────────────────────────

/** Oracle vs candidate on independent clones, diffed on RAM and then the declared live-out. */
function unitDiff(candidate, entry) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `ram ${hex4(ram.addr ?? 0)}: oracle=${ram.a} candidate=${ram.b}`;
  for (const k of LIVE_OUT) {
    if (a.regs[k] !== b.regs[k]) return `${k}: oracle=${a.regs[k]} candidate=${b.regs[k]}`;
  }
  return null;
}

/**
 * Two real captured machines, reused round to round by every sweep below. Cloning one per value
 * copies the whole of RAM 65536 times per arm and dominates the run; the inputs are registers, so
 * re-seating them on one pair reaches the same states. The oracle's return pops, so its stack
 * pointer is restored each round rather than walked into the weeds.
 */
let bench = null;
function benchPair() {
  if (bench === null) {
    const a = anEntry().clone();
    bench = { a, b: anEntry().clone(), sp: a.regs.sp };
  }
  return bench;
}

/** Seat one (displacement, coordinate) on both machines and run the two arms. */
function runPair(candidate, displacement, coordinate) {
  const { a, b, sp } = benchPair();
  a.regs.sp = sp;
  a.regs.hl = displacement;
  a.regs.de = coordinate;
  b.regs.hl = displacement;
  b.regs.de = coordinate;
  oracle(a);
  candidate(b);
  return { a, b };
}

/**
 * Sweep one input over all 65536 values with the other held. RAM is not re-diffed here — the
 * BLIND arm establishes that this routine writes none — so the split is on the live-out alone.
 */
function sweep(candidate, axis, held) {
  const caught = [];
  const missed = [];
  for (let v = 0; v < WIDTH; v++) {
    const on = axis === "displacement";
    const { a, b } = runPair(candidate, on ? v : held, on ? held : v);
    (a.regs.hl === b.regs.hl ? missed : caught).push(v);
  }
  return { caught, missed };
}

/** What the oracle makes of one pair, taken on a real machine. */
function oracleMove(displacement, coordinate) {
  return runPair(brokenNoOp, displacement, coordinate).a.regs.hl;
}

/**
 * The oracle's OWN halving, read back out of it: moving a zero coordinate leaves the displacement
 * minus the half it took off, so the difference is that half. Every derived survivor set below is
 * a predicate over this, never over a twin's arithmetic.
 */
function oracleHalf(displacement) {
  return signed(displacement - oracleMove(displacement, 0));
}

// ── the cycle shim ──────────────────────────────────────────────────────────────────────

/** Adapt a candidate to the cycle-driven host: pay the oracle's total, then take the return. */
function hosted(candidate) {
  return (mm) => {
    candidate(mm);
    mm.tick(ORACLE_TSTATES - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

function replay(candidate, mk = turningMachine) {
  return wholeMachineEquivalence(mk, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: displaceByHalf == oracle on RAM at the real dispatch", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, displaceByHalf, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, `RAM diverged — ${JSON.stringify(r.ram)}`);
  console.log(`  CONTRACT: entered within ${ENTRY_FRAMES} frames; RAM identical`);
});

test("BLIND: RAM alone passes a no-op, so RAM alone is not the gate", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, brokenNoOp, { maxFrames: ENTRY_FRAMES });
  assert.equal(
    r.ram,
    null,
    "the no-op DIVERGED on RAM — this routine writes memory after all, and every arm that " +
      "leans on the live-out instead of RAM must be re-derived",
  );
  console.log("  BLIND: a no-op candidate is RAM-identical — the live-out is the only gate");
});

test("DEGENERATE ENTRY: the first dispatch carries a zero displacement", { skip }, () => {
  let entry = null;
  unitEquivalence(makeMachine, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return displaceByHalf(m);
  }, { maxFrames: ENTRY_FRAMES });
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  assert.equal(entry.regs.hl, 0, "the first entry stopped being the degenerate one");
  for (const [label, twin] of [
    ["unshortened", brokenUnshortened],
    ["quartered", brokenQuartered],
    ["unsigned", brokenUnsigned],
    ["truncated", brokenTruncated],
  ]) {
    assert.equal(unitDiff(twin, entry), null, `the ${label} twin should survive a zero displacement`);
  }
  assert.notEqual(unitDiff(brokenNoOp, entry), null, "the no-op is visible even here");
  console.log(
    `  DEGENERATE: entry displacement ${hex4(entry.regs.hl)}, coordinate ` +
      `${hex4(entry.regs.de)}; nothing is halved, so the halving twins survive the contract arm`,
  );
});

test("CORPUS: every captured displacement replays identically", { skip }, () => {
  const { entries, perTape } = captureCorpus();
  for (const t of perTape) {
    assert.ok(t.dispatches > 0, `vacuous: the ${t.label} tape never reached the routine`);
  }
  for (const entry of entries) {
    const d = unitDiff(displaceByHalf, entry);
    assert.equal(d, null, `${hex4(entry.regs.hl)}: ${d}`);
  }
  const seen = perTape
    .map((t) => `${t.label} ${t.dispatches}/${t.distinct}/${t.negative}`)
    .join(", ");
  console.log(`  CORPUS: ${entries.length} distinct — ${seen} (dispatches/distinct/negative)`);
});

test("EXCLUDED, deliberately: only the dropped registers move, over a whole sweep", { skip }, () => {
  const moved = new Set();
  const held = anEntry().regs.de;
  for (const displacement of everyValue) {
    const { a, b } = runPair(displaceByHalf, displacement, held);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  }
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  for (const k of LIVE_OUT) assert.ok(!moved.has(k), `the live-out ${k} moved somewhere`);
  console.log(`  EXCLUDED: ${[...moved].join(", ")} and pc — the moved coordinate matches`);
});

test("EXHAUSTIVE: both axes sweep clean over all 65536 values", { skip }, () => {
  const coordinate = anEntry().regs.de;
  const displacement = realNegativeOdd();
  for (const [axis, held] of [["displacement", coordinate], ["coordinate", displacement]]) {
    const { caught } = sweep(displaceByHalf, axis, held);
    assert.deepEqual(caught, [], `${axis} sweep diverged at ${caught.slice(0, 4).map(hex4)}`);
  }
  const wrapped = runPair(displaceByHalf, 4, WIDTH - 1);
  assert.equal(wrapped.a.regs.hl, 1, "a coordinate at the top must wrap at 16 bits, not widen");
  assert.equal(wrapped.b.regs.hl, wrapped.a.regs.hl, "and the rewrite must wrap with it");
  const direct = displaceByHalf(anEntry().clone(), 4, WIDTH - 1);
  assert.equal(direct, wrapped.a.regs.hl, "handing the pair in as parameters must land identically");
  console.log(
    `  EXHAUSTIVE: ${WIDTH} displacements against coordinate ${hex4(coordinate)} and ${WIDTH} ` +
      `coordinates against displacement ${hex4(displacement)} (${signed(displacement)})`,
  );
});

test("EXHAUSTIVE: the shim charges exactly what the oracle charges", { skip }, () => {
  for (const displacement of [0, 1, NEGATIVE_FROM - 1, NEGATIVE_FROM, WIDTH - 1]) {
    const m = anEntry().clone();
    m.regs.hl = displacement;
    const before = m.cycles;
    oracle(m);
    assert.equal(m.cycles - before, ORACLE_TSTATES, `${hex4(displacement)}: shim total is wrong`);
  }
  console.log(`  EXHAUSTIVE: the shim's ${ORACLE_TSTATES} T-states match the oracle, branchless`);
});

test("WHOLE-MACHINE: driven play is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(displaceByHalf);
  const fired = w.invocations.get(TARGET);
  assert.ok(fired > 0, "vacuous: the override never dispatched in this many frames");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${fired} dispatches, RAM identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin below is a plausible way to get a halved displacement wrong, and each declares the
// exact inputs it SURVIVES per axis and the exact number it is caught on, so one caught on the
// wrong set fails as loudly as one missed.

const move = (m, value) => {
  m.regs.hl = value & (WIDTH - 1);
};

/** BUG: does nothing — what a gate reading only RAM waves through. */
function brokenNoOp() {}

/** BUG: adds the whole displacement, so the carrier keeps pace instead of falling behind. */
function brokenUnshortened(m) {
  move(m, m.regs.de + m.regs.hl);
}

/** BUG: takes a quarter off instead of a half, so the carrier keeps three quarters of the pace. */
function brokenQuartered(m) {
  move(m, m.regs.de + m.regs.hl - ((m.regs.hl << 16) >> 18));
}

/** BUG: shifts in zeros, so a displacement running the other way is lengthened, not halved. */
function brokenUnsigned(m) {
  move(m, m.regs.de + m.regs.hl - (m.regs.hl >>> 1));
}

/**
 * BUG: rounds the half toward zero instead of toward the negative, which is what dividing and
 * discarding the remainder does in this language. Invisible except on an odd negative.
 */
function brokenTruncated(m) {
  move(m, m.regs.de + m.regs.hl - ((signed(m.regs.hl) / 2) | 0));
}

/** BUG: drops the coordinate, so the carrier is teleported to half the displacement every frame. */
function brokenNoCoordinate(m) {
  move(m, m.regs.hl - ((m.regs.hl << 16) >> 17));
}

/**
 * BUG: reads the coordinate from a value baked in when this file was written instead of from the
 * caller. It is right on every dispatch that happens to carry that coordinate and wrong on the
 * rest, which is what a single captured dispatch cannot tell apart.
 */
let PINNED_COORDINATE = 0;
function brokenPinnedCoordinate(m) {
  move(m, PINNED_COORDINATE + m.regs.hl - ((m.regs.hl << 16) >> 17));
}

/**
 * Per twin: the inputs it survives on each axis, and the total it is caught on across both —
 * MEASURED, and asserted as a partition rather than as a bare count. `null` means "declared by a
 * predicate below", where the set is too large to list or must come from the oracle.
 */
const TWINS = [
  ["no-op", brokenNoOp, { displacement: null, coordinate: null }, 131069],
  ["unshortened", brokenUnshortened, { displacement: null, coordinate: [] }, 131070],
  ["quartered", brokenQuartered, { displacement: null, coordinate: [] }, 131068],
  ["unsigned", brokenUnsigned, { displacement: null, coordinate: [] }, 98304],
  ["truncated", brokenTruncated, { displacement: null, coordinate: [] }, 81920],
  ["no-coordinate", brokenNoCoordinate, { displacement: [], coordinate: [0] }, 131071],
  ["pinned-coordinate", brokenPinnedCoordinate, { displacement: null, coordinate: null }, 65535],
];

/**
 * The survivor sets too large to write out, each a predicate over the ORACLE's own halving or
 * over what the oracle leaves standing — never over the twin's own arithmetic.
 */
function declaredSurvivors(label, axis, held) {
  if (label === "no-op") {
    return axis === "displacement"
      ? everyValue.filter((d) => oracleMove(d, held) === d)
      : everyValue.filter((c) => oracleMove(held, c) === held);
  }
  if (label === "unshortened") {
    return everyValue.filter((d) => oracleMove(d, 0) === d);
  }
  if (label === "quartered") {
    return everyValue.filter((d) => Math.floor(oracleHalf(d) / 2) === oracleHalf(d));
  }
  if (label === "unsigned") {
    return everyValue.filter((d) => oracleHalf(d) >= 0);
  }
  if (label === "truncated") {
    return everyValue.filter((d) => oracleHalf(d) >= 0 || signed(d) === 2 * oracleHalf(d));
  }
  return axis === "displacement" ? everyValue : [PINNED_COORDINATE];
}

for (const [label, twin, survives, caughtTotal] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared inputs`, { skip }, () => {
    PINNED_COORDINATE = anEntry().regs.de;
    const axes = [
      ["displacement", anEntry().regs.de],
      ["coordinate", realNegativeOdd()],
    ];
    let total = 0;
    for (const [axis, held] of axes) {
      const { caught, missed } = sweep(twin, axis, held);
      const declared = survives[axis] ?? declaredSurvivors(label, axis, held);
      assert.deepEqual(missed, declared, `${label} on the ${axis} axis: wrong survivor set`);
      assert.deepEqual(
        [...caught, ...missed].sort((x, y) => x - y),
        everyValue,
        "caught and missed must PARTITION the axis, sharing none and omitting none",
      );
      total += caught.length;
    }
    assert.equal(total, caughtTotal, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${total} of ${2 * WIDTH} swept inputs`);
  });

  test(`TEETH: the ${label} twin FORKS the whole machine`, { skip }, () => {
    PINNED_COORDINATE = anEntry().regs.de;
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(w.equal, false, `the ${label} twin ran clean — the replay has no teeth`);
    console.log(`  TEETH/${label}: forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  });
}

test("TEETH: the halving twins' blind sets come from the ORACLE, not from the twins", { skip }, () => {
  const whole = everyValue.filter((d) => oracleMove(d, 0) === d);
  assert.deepEqual(whole, [0, 1], "the displacements the oracle leaves whole changed");
  const held = anEntry().regs.de;
  assert.deepEqual(
    sweep(brokenUnshortened, "displacement", held).missed,
    whole,
    "the unshortened twin survives exactly where nothing is taken off",
  );

  const coarse = everyValue.filter((d) => Math.floor(oracleHalf(d) / 2) === oracleHalf(d));
  assert.deepEqual(coarse, [0, 1, WIDTH - 2, WIDTH - 1], "the too-small-to-tell-apart set changed");
  assert.deepEqual(
    sweep(brokenQuartered, "displacement", held).missed,
    coarse,
    "the quartered twin survives exactly where a quarter and a half come out the same",
  );
  console.log("  TEETH: two blind sets re-derived from the oracle's own halving");
});

test("THE CORPUS IS A WARNING: the shared tape is blind to two of the twins", { skip }, () => {
  const { perTape } = captureCorpus();
  const shared = perTape.find((t) => t.label === "shared");
  assert.equal(shared.negative, 0, "the shared tape started turning — re-derive this arm");
  for (const [label, twin] of [["unsigned", brokenUnsigned], ["truncated", brokenTruncated]]) {
    const blind = replay(twin, makeMachine);
    assert.ok(blind.invocations.get(TARGET) > 0, `vacuous: the ${label} twin never dispatched`);
    assert.equal(blind.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(
      blind.equal,
      true,
      `the shared tape now catches the ${label} twin — good, but the turning tape was built ` +
        "because it did not, and this arm has to be re-derived rather than deleted",
    );
    const turning = replay(twin);
    assert.equal(turning.equal, false, "the turning tape must catch what the shared tape cannot");
    console.log(
      `  WARNING/${label}: ${WHOLE_FRAMES} shared frames identical with the twin wired; the ` +
        `turning tape forks it at frame ${turning.frame} on ${hex4(turning.addr ?? 0)}`,
    );
  }
});
