// SPDX-License-Identifier: GPL-3.0-only
/**
 * velocityForHeading — memory-equivalent to the frozen oracle at ROM 0x596E.
 *
 * GATE: strict unit-capture, a corpus of real dispatches from three tapes, an exhaustive sweep of
 *   the entire input space, and a whole-machine replay of driven play. RAM ALONE CANNOT GATE THIS
 *   ROUTINE. It writes no memory, so unitEquivalence reports `ram: null` for the correct arm, for
 *   every broken twin, and for a bare no-op. Test 2 asserts exactly that, and it is the written
 *   justification for gating everywhere else on RAM *plus* the declared live-out {b, c, d, e}.
 *
 * What it exercises, holes stated:
 *   1. CONTRACT — unitEquivalence at the first real dispatch: RAM identical. `equal` is not
 *      asserted; it folds in the register diff this contract deliberately drops.
 *   2. BLIND — the same call passes a no-op. If it ever fails, the routine writes memory after
 *      all and every arm below that leans on the live-out has to be re-derived.
 *   3. DEGENERATE ENTRY — the captured entry sits on a cardinal heading of one table, and two of
 *      the four twins below are INVISIBLE there. Raising maxFrames cannot help: unitEquivalence
 *      clones the FIRST entry, and the shared tape holds that one heading for its whole run.
 *   4. CORPUS — every distinct (table, heading) pair three tapes produce, each replayed from its
 *      own captured machine: the shared coin -> start tape, the same tape with the stick walked
 *      round the compass, and undriven attract.
 *   5. EXCLUDED — across the whole sweep the registers that move are exactly {a, f, h, l, sp} and
 *      the live-out never moves. What licenses dropping them is the CALLERS: all five arrive by a
 *      jump or a fall-through, and every continuation overwrites the accumulator and the address
 *      pair before reading either and branches on no flag. Test 8 is the falsifiable version.
 *   6. EXHAUSTIVE — all 256 headings on each of the four tables the callers hand in.
 *   7. TEETH — four twins. Each declares the EXACT set of headings it survives, the test asserts
 *      caught and missed PARTITION the 256, and the quarter-turn twin's blind set is re-derived
 *      from the table data rather than from the twin, so a gate that agreed with a wrong theory
 *      of which headings are indistinguishable would fail here instead of passing.
 *   8. WHOLE-MACHINE — driven play with the rewrite wired, RAM diffed every frame against the
 *      all-oracle baseline, and every twin caught there too. This is the arm that makes the
 *      live-out declaration falsifiable: a register some caller really consumed would fork here.
 *
 * The replay needs a shim, `hosted()`. The host engine is cycle-driven and every caller arrives by
 * transfer rather than by a call, so a candidate that charges no T-states and does not take the
 * Z80 return both moves the vblank interrupt and leaks two stack bytes per dispatch. The shim pays
 * both, identically for the real arm and for every twin. The oracle's total is branch-dependent,
 * so it is computed rather than constant, and test 9 checks the computation against the oracle
 * over the whole sweep. It belongs to the harness, not to the routine.
 *
 * NO STACK-SCRATCH WINDOW IS DRAWN, deliberately. The routine writes no RAM, so there is nothing
 * to exclude and the whole-machine diff covers every byte, the stack included.
 *
 * HOLE: three tapes, and only three of the four tables appear in them. The fourth is covered by
 * the sweep alone, on a machine captured from a dispatch that used a different one.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-596e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { velocityForHeading } from "../velocityForHeading.js";
import { loc_596e as oracle } from "../../translated/loc_596e.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x596e;

/** The heading byte's offset inside the record the caller points at. */
const HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

/** The four table bases the five callers hand in. Only the first three appear in the corpus. */
const TABLES = [0x5e00, 0x2e3e, 0x59d7, 0x08fa];
const FIXED_TABLE = TABLES[1];

const LIVE_OUT = ["b", "c", "d", "e"];
const EXCLUDED = ["a", "f", "h", "l", "sp"];

const CORPUS_FRAMES = 1500;
const WHOLE_FRAMES = 1400;

/** T-states charged before the return, on the path where all three branches fall through. */
const STRAIGHT_LINE = 117;
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
const headingOf = (mm) => mm.mem8[mm.regs.ix + HEADING_CELL];
const keyOf = (mm) => `${hex4(mm.regs.hl)}/${headingOf(mm)}`;
const everyHeading = Array.from({ length: HEADINGS }, (_unused, h) => h);

/**
 * The shared tape, plus the stick walked once round the compass. Without it the plane holds one
 * heading for the whole run and most of this routine's input space never occurs in play.
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
    const keys = new Set();
    const m = makeMachine(
      new Map([[TARGET, (mm) => {
        dispatches++;
        keys.add(keyOf(mm));
        if (!byKey.has(keyOf(mm))) byKey.set(keyOf(mm), mm.clone());
        return oracle(mm);
      }]]),
      opts,
    );
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `${label} capture stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, `${label} capture ran short`);
    perTape.push({ label, dispatches, distinct: keys.size });
  }
  corpus = { entries: [...byKey.values()], keys: [...byKey.keys()], perTape };
  return corpus;
}

const anEntry = () => captureCorpus().entries[0];

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

/** A real captured machine nudged onto one (table, heading), which is the crafted-entry idiom. */
function craft(table, heading) {
  const m = anEntry().clone();
  m.regs.hl = table;
  m.mem8[m.regs.ix + HEADING_CELL] = heading;
  return m;
}

/** Split `table`'s headings into the ones a candidate is caught on and the ones it survives. */
function split(candidate, table) {
  const caught = [];
  const missed = [];
  for (const h of everyHeading) {
    (unitDiff(candidate, craft(table, h)) === null ? missed : caught).push(h);
  }
  return { caught, missed };
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

test("CONTRACT: velocityForHeading == oracle on RAM at the real dispatch", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, velocityForHeading, { maxFrames: ENTRY_FRAMES });
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

test("DEGENERATE ENTRY: two real twins are invisible at the first dispatch", { skip }, () => {
  let entry = null;
  unitEquivalence(makeMachine, TARGET, oracle, (m) => {
    if (entry === null) entry = m.clone();
    return velocityForHeading(m);
  }, { maxFrames: ENTRY_FRAMES });
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");

  const heading = headingOf(entry);
  assert.equal(unitDiff(brokenQuarterForward, entry), null, "the quarter-turn twin should survive");
  assert.equal(unitDiff(brokenUnwrapped, entry), null, "the unwrapped twin should survive");
  assert.notEqual(
    unitDiff(brokenNoOp, entry),
    null,
    "even the no-op is invisible here — the entry is degenerate in the live-out too",
  );
  console.log(
    `  DEGENERATE: entry is table ${hex4(entry.regs.hl)} heading ${heading}; the quarter-turn ` +
      "and unwrapped twins both survive it, which is why the sweep is the load-bearing arm",
  );
});

test("CORPUS: every captured (table, heading) pair replays identically", { skip }, () => {
  const { entries, perTape } = captureCorpus();
  for (const t of perTape) {
    assert.ok(t.dispatches > 0, `vacuous: the ${t.label} tape never reached the routine`);
  }
  for (const entry of entries) {
    const d = unitDiff(velocityForHeading, entry);
    assert.equal(d, null, `${keyOf(entry)}: ${d}`);
  }
  const seen = perTape.map((t) => `${t.label} ${t.dispatches}/${t.distinct}`).join(", ");
  console.log(`  CORPUS: ${entries.length} distinct pairs replayed — ${seen} (dispatches/distinct)`);
});

test("EXCLUDED, deliberately: only the dropped registers move, over the whole sweep", { skip }, () => {
  const moved = new Set();
  for (const table of TABLES) {
    for (const heading of everyHeading) {
      const a = craft(table, heading);
      const b = craft(table, heading);
      oracle(a);
      velocityForHeading(b);
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
      assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    }
  }
  assert.deepEqual(
    REG_FIELDS.filter((k) => moved.has(k)),
    EXCLUDED,
    "the excluded set changed shape: only the accumulator, the flag byte, the address pair " +
      "and the stack pointer may differ",
  );
  for (const k of LIVE_OUT) assert.ok(!moved.has(k), `the live-out ${k} moved somewhere`);
  console.log(`  EXCLUDED: ${[...moved].join(", ")} and pc — the pair matches everywhere`);
});

test("EXHAUSTIVE: 256 headings on each of the four tables are identical", { skip }, () => {
  let swept = 0;
  for (const table of TABLES) {
    for (const heading of everyHeading) {
      const d = unitDiff(velocityForHeading, craft(table, heading));
      assert.equal(d, null, `${hex4(table)}/${heading}: ${d}`);
      swept++;
    }
  }
  assert.equal(swept, TABLES.length * HEADINGS, "the sweep did not cover the whole space");
  console.log(`  EXHAUSTIVE: ${swept} (table, heading) combinations identical`);
});

test("EXHAUSTIVE: the shim charges exactly what the oracle charges", { skip }, () => {
  for (const table of TABLES) {
    for (const heading of everyHeading) {
      const m = craft(table, heading);
      const predicted = oracleTStates(m);
      const before = m.cycles;
      oracle(m);
      assert.equal(m.cycles - before, predicted, `${hex4(table)}/${heading}: shim total is wrong`);
    }
  }
  console.log("  EXHAUSTIVE: the shim's T-state total matches the oracle on every combination");
});

test("WHOLE-MACHINE: driven play is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(velocityForHeading);
  const fired = w.invocations.get(TARGET);
  assert.ok(fired > 0, "vacuous: the override never dispatched in this many frames");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${fired} dispatches, RAM identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Four plausible ways to get a two-sample table read wrong. Each declares the exact headings it
// SURVIVES, so a twin caught on the wrong set fails as loudly as one that is not caught at all.

/** BUG: does nothing — what a gate reading only RAM waves through. */
function brokenNoOp() {}

const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];

/** BUG: takes the partner a quarter turn FORWARD, which is the same axis with the sign flipped. */
function brokenQuarterForward(m) {
  m.regs.de = sampleAt(m, m.regs.hl, headingOf(m));
  m.regs.bc = sampleAt(m, m.regs.hl, headingOf(m) + QUARTER);
}

/** BUG: steps back a quarter turn without wrapping, so low headings read below the table. */
function brokenUnwrapped(m) {
  m.regs.de = m.mem16[m.regs.hl + 2 * headingOf(m)];
  m.regs.bc = m.mem16[m.regs.hl + 2 * headingOf(m) - 2 * QUARTER];
}

/** BUG: ignores the table the caller chose, so every caller gets one speed. */
function brokenFixedTable(m) {
  m.regs.de = sampleAt(m, FIXED_TABLE, headingOf(m));
  m.regs.bc = sampleAt(m, FIXED_TABLE, headingOf(m) - QUARTER);
}

/**
 * The exact headings each twin survives, per table — MEASURED, and asserted as a partition of the
 * 256 rather than as a bare count. The quarter-turn twin survives only where the two candidate
 * partners hold the same value; the unwrapped twin survives wherever no wrap was needed, plus two
 * headings on the first table where the bytes just below it happen to match.
 */
const FROM_QUARTER = everyHeading.filter((h) => h >= QUARTER);
const TWINS = [
  ["no-op", brokenNoOp, () => []],
  ["quarter-forward", brokenQuarterForward, () => [0, 127, 128, 255]],
  ["unwrapped", brokenUnwrapped, (t) => (t === TABLES[0] ? [0, 1, ...FROM_QUARTER] : FROM_QUARTER)],
  ["fixed-table", brokenFixedTable, (t) => (t === FIXED_TABLE ? everyHeading : [])],
];

for (const [label, twin, survives] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared headings`, { skip }, () => {
    let total = 0;
    for (const table of TABLES) {
      const { caught, missed } = split(twin, table);
      assert.deepEqual(missed, survives(table), `${label} on ${hex4(table)}: wrong survivor set`);
      assert.deepEqual(
        [...caught, ...missed].sort((x, y) => x - y),
        everyHeading,
        "caught and missed must PARTITION the headings, sharing none and omitting none",
      );
      total += caught.length;
    }
    console.log(`  TEETH/${label}: caught on ${total} of ${TABLES.length * HEADINGS}`);
  });

  test(`TEETH: the ${label} twin FORKS the whole machine`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(w.equal, false, `the ${label} twin ran clean — the replay has no teeth`);
    console.log(`  TEETH/${label}: forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  });
}

test("TEETH: the quarter-turn twin's blind set comes from the DATA, not from the twin", { skip }, () => {
  for (const table of TABLES) {
    const m = anEntry();
    const indistinguishable = everyHeading.filter(
      (h) => sampleAt(m, table, h - QUARTER) === sampleAt(m, table, h + QUARTER),
    );
    assert.deepEqual(
      indistinguishable,
      [0, 127, 128, 255],
      `${hex4(table)}: the headings where the two candidate partners agree changed`,
    );
  }
  console.log("  TEETH: the four blind headings are exactly where the partners hold equal values");
});
