// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepCopyrightScreenAwaitingStart — memory-equivalent to the frozen oracle at ROM 0x07E6.
 * GATE: unit-capture on the real dispatch plus crafted branch entries; RAM compared with the dead
 *   stack scratch below the seated SP masked out (the oracle nests calls, the rewrite does not),
 *   the SP re-seat and the return value checked, and teeth. Registers are not compared: the
 *   dissolved callees do not reproduce the register dance and the routine's three heterogeneous
 *   exits mean no caller consumes one. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-07e6.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stepCopyrightScreenAwaitingStart as candidate } from "../stepCopyrightScreenAwaitingStart.js";
import { loc_07e6 as oracle } from "../../translated/loc_07e6.js";
import { stampCopyrightStrip } from "../stampCopyrightStrip.js";
import { flashCopyrightLine } from "../flashCopyrightLine.js";
import { sampleCellGlyphAndColour } from "../sampleCellGlyphAndColour.js";
import { startOnePlayerGame } from "../startOnePlayerGame.js";
import { postCommand } from "../postCommand.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";

const TARGET = 0x07e6;
const IN0_MIRROR = 0xa9ae;
const ONE_PLAYER_START = 0x08;
const CREDIT_COUNT = 0xa986;
const SAMPLE_CELL = 0xa61c;
const SAMPLE_RECORD = 0xabfe;
const COMMAND = 1;
const ARGUMENT = 25;

// The four object entries the copyright strip fills, both halves of each.
const STRIP_CELLS = [
  0xaa10, 0xaa11, 0xaa12, 0xaa13, 0xaa14, 0xaa15, 0xaa16, 0xaa17,
  0xaa40, 0xaa41, 0xaa42, 0xaa43, 0xaa44, 0xaa45, 0xaa46, 0xaa47,
];

// Every path's writes land at or below here; the stack seats far above it, so masking the scratch
// window can never hide a game-data divergence. Asserted against the measured floor below.
const DATA_TOP = 0xadff;
const CORPUS_FRAMES = 2000;
const COINSTART_DISPATCHES = 71;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/**
 * Oracle vs a candidate on independent clones. The oracle nests calls and leaves dead return
 * addresses in the stack scratch the rewrite never writes, so the diff excludes [lowestSp, seat)
 * — lowestSp measured by watching the oracle's own pushes. Anything outside that window has escaped.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => {
    push(v);
    if (a.regs.sp < low) low = a.regs.sp;
  };
  const retOracle = oracle(a);
  const retCand = cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

/** Cells the oracle moves from a state, ignoring the stack scratch — a branch's footprint. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.push(addr);
  }
  return cells;
}

// ── the captured entry, and the crafted branch entries ──────────────────────────────────

let entry = null;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

function craft(mutate) {
  const m = entryState().clone();
  mutate(m);
  return m;
}

/** The captured entry takes the return-on-one-credit path; the other two are poked in. */
function scenarios() {
  return [
    ["captured", craft(() => {})],
    ["start", craft((m) => { m.mem8[IN0_MIRROR] |= ONE_PLAYER_START; })],
    ["retz", craft((m) => { m.mem8[IN0_MIRROR] &= ~ONE_PLAYER_START; m.mem8[CREDIT_COUNT] = 1; })],
    ["advance", craft((m) => { m.mem8[IN0_MIRROR] &= ~ONE_PLAYER_START; m.mem8[CREDIT_COUNT] = 5; })],
    ["dirtyStrip", craft((m) => { for (const a of STRIP_CELLS) m.mem8[a] = 0x5a; })],
  ];
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every parameter matches stepCopyrightScreenAwaitingStart by default. */
function twin({ stamp = true, record = SAMPLE_RECORD, startHeld = (b) => b, arg = ARGUMENT, advance = true }) {
  return (m) => {
    const { mem8 } = m;
    if (stamp) stampCopyrightStrip(m);
    flashCopyrightLine(m);
    sampleCellGlyphAndColour(m, SAMPLE_CELL, record);
    if (startHeld(mem8[IN0_MIRROR] & ONE_PLAYER_START)) return startOnePlayerGame(m);
    if (mem8[CREDIT_COUNT] === 1) return;
    postCommand(m, COMMAND, arg);
    if (advance) return advanceSequenceSubStep(m);
    return undefined;
  };
}

const TWINS = [
  ["no-op", () => {}, 5],
  ["skip-stamp", twin({ stamp: false }), 1],
  ["wrong-sample-record", twin({ record: 0xabf0 }), 5],
  ["invert-start", twin({ startHeld: (b) => !b }), 5],
  ["wrong-argument", twin({ arg: 26 }), 1],
  ["skip-advance", twin({ advance: false }), 1],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, entryState());
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  // ★ The mask is safe only if it never covers a data cell: prove its floor sits above them all.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("PATHS: every branch is memory-equivalent, and the branches really differ", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[label] = footprint(m).join(",");
  }
  // ★ Vacuity guard: the three real paths must leave DIFFERENT cells, or the pokes changed nothing
  // and the arm would pass a rewrite that ignored the branch entirely.
  assert.notEqual(prints.start, prints.advance, "the start and advance paths move the same cells");
  assert.notEqual(prints.retz, prints.advance, "the return path and advance path move the same cells");
  console.log(`  PATHS: 5 scenarios equivalent; start moves ${prints.start.split(",").length} cells`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops a return address and the rewrite does not`);
    assert.equal(r.retOracle, r.retCand, `${label}: the return value diverged`);
  }
  console.log("  SP: +2 on every path; return values identical");
});

test("CORPUS: every coin-start dispatch replays identically; attract never reaches it", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0;
    let caught = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (compare(candidate, mm).escaped) caught++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, caught };
  };
  const coinStart = run({});
  const attract = run({ tape: [] });
  assert.equal(coinStart.dispatched, COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(coinStart.caught, 0, `the rewrite diverged on ${coinStart.caught} coin-start dispatches`);
  // ★ Attract reaching zero is a fact, not an untested tap: the SAME probe counted 71 under coin-start.
  assert.equal(attract.dispatched, 0, "attract now reaches this credit-state arm; add a corpus for it");
  console.log(`  CORPUS: ${coinStart.dispatched} coin-start dispatches identical, attract ${attract.dispatched}`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(brokenTwin, m).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} scenarios`);
  });
}
