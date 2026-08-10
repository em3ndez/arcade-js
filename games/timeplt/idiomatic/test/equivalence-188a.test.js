// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepTwoCreditCopyrightScreenAwaitingStart — the copyright screen's await-start step. GATE: real dispatches on two credit-loaded
 * tapes (a two-player start and a one-player start both flow through here), plus crafted button
 * cases. RAM compared with the dead stack scratch below the seated SP masked out, the SP re-seat
 * and return value checked, registers held to a measured ceiling, and teeth.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-188a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, COIN_FRAME, START_FRAME, romsPresent } from "./_harness.js";
import { stepTwoCreditCopyrightScreenAwaitingStart as candidate } from "../stepTwoCreditCopyrightScreenAwaitingStart.js";
import { loc_188a as oracle } from "../../translated/loc_188a.js";
import { stampCopyrightStrip } from "../stampCopyrightStrip.js";
import { flashCopyrightLine } from "../flashCopyrightLine.js";
import { startTwoPlayerGame } from "../startTwoPlayerGame.js";
import { startOnePlayerGame } from "../startOnePlayerGame.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x188a;
const IN0 = 0xc300;
const IN0_MIRROR = 0xa9ae;
const START_BITS = 0x18;
const TWO_PLAYER = 0x10;
const ONE_PLAYER = 0x08;
const HOLD = 8;

// Every write this routine and its start callees make lands at or below here; the stack seats far
// above it, so masking the scratch window can never hide a data divergence (asserted against low).
const DATA_TOP = 0xadff;

// The measured ceiling. The two callers reach here by tail dispatch and read no register; the
// dissolved calls and start routines leave these where the frozen pushes and rets do not. ix and
// the EXX bank stay put, so ix is the control the EXCLUDED arm scribbles. Checked as a subset.
const EXCLUDED = ["a", "a_", "b", "c", "d", "e", "f", "f_", "h", "iy", "l", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// Two credits then a start button. stepTwoCreditCopyrightScreenAwaitingStart is the two-credit copyright screen's await step; the
// default one-coin coin-start tape reaches the game by another route and never dispatches it.
const twoCredits = (startBit) => [
  { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
  { frame: COIN_FRAME + 60, port: IN0, bits: 0x01, dur: HOLD },
  { frame: START_FRAME, port: IN0, bits: startBit, dur: HOLD },
];
const TWO_PLAYER_TAPE = twoCredits(TWO_PLAYER);
const ONE_PLAYER_TAPE = twoCredits(ONE_PLAYER);

// ── capture and comparison ────────────────────────────────────────────────────────────────

function captureTape(tape) {
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), { tape });
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  return entries;
}

let twoTape = null;
let oneTape = null;
function twoPlayerRun() { return (twoTape ??= captureTape(TWO_PLAYER_TAPE)); }
function onePlayerRun() { return (oneTape ??= captureTape(ONE_PLAYER_TAPE)); }
function corpus() { return [...twoPlayerRun(), ...onePlayerRun()]; }

const heldIs = (bits) => (e) => (e.mem8[IN0_MIRROR] & START_BITS) === bits;
function pick(entries, bits, what) {
  const e = entries.find(heldIs(bits));
  assert.notEqual(e ?? null, null, `vacuous: no captured turn ${what}`);
  return e;
}
function craft(base, bits) {
  const m = base.clone();
  m.mem8[IN0_MIRROR] = (m.mem8[IN0_MIRROR] & ~START_BITS) | bits;
  return m;
}

function scenarios() {
  const ret = pick(twoPlayerRun(), 0x00, "left the start buttons idle");
  return [
    ["ret", ret],
    ["two-player", pick(twoPlayerRun(), TWO_PLAYER, "pressed the two-player start")],
    ["one-player", pick(onePlayerRun(), ONE_PLAYER, "pressed the one-player start")],
    ["both-held", craft(ret, START_BITS)],
    ["one-player-craft", craft(ret, ONE_PLAYER)],
  ];
}

/**
 * Oracle vs candidate on independent clones. The oracle brackets each dissolved call with a push
 * and pops the tail-jump slot, so the diff excludes [low, seat) — low watched off its own pushes.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
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
  let reg = null;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
  }
  return { escaped, reg, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────

const dispatch = (m) => {
  const bt = m.mem8[IN0_MIRROR];
  if (bt & TWO_PLAYER) return startTwoPlayerGame(m);
  if (bt & ONE_PLAYER) return startOnePlayerGame(m);
};
const brokenNoOp = () => {};
const brokenSkipFlash = (m) => { stampCopyrightStrip(m); return dispatch(m); };
const brokenSwapStarts = (m) => {
  stampCopyrightStrip(m); flashCopyrightLine(m);
  const bt = m.mem8[IN0_MIRROR];
  if (bt & TWO_PLAYER) return startOnePlayerGame(m);
  if (bt & ONE_PLAYER) return startTwoPlayerGame(m);
};
const brokenBit3First = (m) => {
  stampCopyrightStrip(m); flashCopyrightLine(m);
  const bt = m.mem8[IN0_MIRROR];
  if (bt & ONE_PLAYER) return startOnePlayerGame(m);
  if (bt & TWO_PLAYER) return startTwoPlayerGame(m);
};
const brokenNeverDispatch = (m) => { stampCopyrightStrip(m); flashCopyrightLine(m); };
const brokenMovesIx = (m) => { const r = candidate(m); m.regs.ix = (m.regs.ix + 1) & 0xffff; return r; };

const TWINS = [
  ["no-op", brokenNoOp, 5],
  ["skip-flash", brokenSkipFlash, 5],
  ["swap-starts", brokenSwapStarts, 4],
  ["bit3-first", brokenBit3First, 1],
  ["never-dispatch", brokenNeverDispatch, 4],
];

function movedOver(cand) {
  const moved = new Set();
  for (const [, m] of scenarios()) {
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    cand(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("CORPUS: every real dispatch of both tapes replays identically, and none is a no-op",
  { skip }, () => {
    const all = corpus();
    for (const e of all) {
      const r = compare(candidate, e);
      assert.equal(r.escaped, null, `${hex4(e.mem8[IN0_MIRROR])}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
      assert.equal(r.reg, null, `register ${r.reg && r.reg.k} diverged outside the ceiling`);
      assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
    }
    const writing = all.filter((e) => footprint(e) > 0).length;
    assert.ok(writing > 0, "no captured turn makes the oracle write a byte, so the corpus is all no-ops");
    console.log(`  CORPUS: ${all.length} dispatches identical, ${writing} of them write`);
  });

test("PATHS: every scenario equivalent, and a start branch moves more than the idle ret", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${label}: register ${r.reg && r.reg.k} diverged`);
    prints[label] = footprint(m);
  }
  // ★ Vacuity guard: the start dispatch must move more cells than the button-idle ret, or a rewrite
  // that ignored the branch would pass.
  assert.ok(prints["two-player"] > prints["ret"], "the start branch moved no extra cells");
  assert.ok(prints["ret"] > 0, "even the idle ret wrote nothing, so the stamp/flash arms are dead");
  console.log(`  PATHS: ret ${prints["ret"]}, two-player ${prints["two-player"]}, one-player ${prints["one-player"]}`);
});

test("UNREACHED: the coin-start tape and attract do not dispatch this, with a live control",
  { skip }, () => {
    const count = (opts) => {
      let seen = 0;
      const m = makeMachine(new Map([[TARGET, (mm) => { seen++; return oracle(mm); }]]), opts);
      m.runFrames(ENTRY_FRAMES);
      assert.equal(m.stoppedBy, null, `run stopped early: ${m.stoppedBy}`);
      return seen;
    };
    const control = count({ tape: TWO_PLAYER_TAPE });
    // ★ The zeros count only because the same tap, in the same instrument, saw the two-credit tape.
    assert.ok(control > 0, "the tap counted nothing even under the two-player tape, so it is broken");
    assert.equal(count({}), 0, "the coin-start tape now dispatches this; capture a plain entry");
    assert.equal(count({ tape: [] }), 0, "attract now reaches this; add a corpus for it");
    console.log(`  UNREACHED: coin-start 0, attract 0, two-credit ${control}`);
  });

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops the tail slot and the rewrite does not`);
    assert.equal(r.retOracle, r.retCand, `${label}: the return value diverged`);
  }
  console.log("  SP: +2 on every scenario; return values identical");
});

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const moved = movedOver(candidate);
  const control = movedOver(brokenMovesIx);
  // ★ A clean reading is worth nothing unless the same measurement reports ix for a twin that moves it.
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles ix, so a clean reading proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: observed moving ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; control also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(twin, m).escaped || compare(twin, m).reg) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} scenarios`);
  });
}
