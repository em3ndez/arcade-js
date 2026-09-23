// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceCoinInputs — memory-equivalent to the frozen oracle at ROM 0x48be. A five-call sequence whose ROM
 * calls are all dissolved to direct imports, so the rewrite models no stack and omits its own ret.
 * The delegated handlers hold their working values in local scratch rather than the register file, so
 * the contract here is RAM equivalence: every dispatch of both tapes writes the same cells (coin
 * debounce lines, accumulators, tally, packed-BCD credit count and the latched coin-counter lines)
 * outside the masked stack window, and the two-byte re-seat and return value match. Crafted states
 * force each debounce edge and both coin-counter pulses.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-48be.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { serviceCoinInputs as candidate } from "../serviceCoinInputs.js";
import { loc_48be as oracle } from "../../translated/loc_48be.js";
import { awardOneCreditOnDebouncedInputEdge } from "../awardOneCreditOnDebouncedInputEdge.js";
import { tallyCoinSlot1AndAwardCredit } from "../tallyCoinSlot1AndAwardCredit.js";
import { meterCoinageTowardCreditOnEdge } from "../meterCoinageTowardCreditOnEdge.js";
import { pulseSlot1CoinCounter } from "../pulseSlot1CoinCounter.js";
import { pulseSlot2CoinCounter } from "../pulseSlot2CoinCounter.js";

const TARGET = 0x48be;
const IN0_MIRROR = 0xa9ae;
const HIST_FLAT = 0xa983;
const HIST_COIN1 = 0xa9c7;
const PHASE_DRIP = 0xa9ca;
const COIN1_DEBT = 0xa981;
const COIN1_TIMER = 0xa984;
const COIN2_DEBT = 0xa982;
const COIN2_TIMER = 0xa985;
const CREDIT_COUNT = 0xa986;

// Every game write lands at or below here; the deepest push stays above it, so masking the stack
// scratch can never hide a data divergence. Asserted against the measured floor below.
const DATA_TOP = 0xadff;
const DISPATCHES_PER_TAPE = 1165;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

function capture(opts) {
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  return entries;
}

let corpusCache = null;
function corpus() {
  if (!corpusCache) corpusCache = [...capture({}), ...capture({ tape: [] })];
  return corpusCache;
}

// Oracle vs candidate on independent clones, compared on RAM only. The oracle pushes a return per
// delegated call and rets its own; the rewrite models no stack, so [low, seat) is masked, low
// watched off both sides' pushes. The delegated handlers keep their scratch in locals, not the
// register file, so registers carry no live-out and are not part of the contract.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const pa = a.push16.bind(a);
  a.push16 = (v) => { pa(v); if (a.regs.sp < low) low = a.regs.sp; };
  const pb = b.push16.bind(b);
  b.push16 = (v) => { pb(v); if (b.regs.sp < low) low = b.regs.sp; };
  const ra = oracle(a);
  const rb = cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, retEq: ra === rb };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  return n;
}

function working() { return corpus().find((m) => footprint(m) > 0); }

// A captured entry with the three debounce histories seeded so each rotation is observable; debts
// off (no pulse) for one, both slots owed for the other.
function seedDebounce(m) { m.mem8[HIST_FLAT] = 0x01; m.mem8[HIST_COIN1] = 0x01; m.mem8[PHASE_DRIP] = 0x01; }
function base() { return working() ?? corpus()[0]; }
let probesCache = null;
function probes() {
  if (!probesCache) {
    const debounce = base().clone();
    seedDebounce(debounce); debounce.mem8[COIN1_DEBT] = 0; debounce.mem8[COIN2_DEBT] = 0;
    const debt = base().clone();
    seedDebounce(debt);
    debt.mem8[COIN1_DEBT] = 2; debt.mem8[COIN1_TIMER] = 0;
    debt.mem8[COIN2_DEBT] = 2; debt.mem8[COIN2_TIMER] = 0;
    probesCache = { debounce, debt };
  }
  return probesCache;
}

// Deep paths the tapes rarely reach: a clean edge on each debounce line, and both pulses armed.
let edgesCache = null;
function edges() {
  if (!edgesCache) {
    const flat = base().clone(); flat.mem8[IN0_MIRROR] = 0xff; flat.mem8[HIST_FLAT] = 0;
    const coin1 = base().clone(); coin1.mem8[IN0_MIRROR] = 0xff; coin1.mem8[HIST_COIN1] = 0;
    const drip = base().clone(); drip.mem8[IN0_MIRROR] = 0xff; drip.mem8[PHASE_DRIP] = 0;
    edgesCache = { flat, coin1, drip, debt: probes().debt };
  }
  return edgesCache;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────────
function twin(drop) {
  return function body(m) {
    if (drop !== "flat") awardOneCreditOnDebouncedInputEdge(m);
    if (drop !== "coin1") tallyCoinSlot1AndAwardCredit(m);
    if (drop !== "drip") meterCoinageTowardCreditOnEdge(m);
    if (drop !== "pulse1") pulseSlot1CoinCounter(m);
    if (drop !== "pulse2") pulseSlot2CoinCounter(m);
  };
}
function noOp() {}

const TWINS = [
  ["no-op", noOp, 2],
  ["drop-flat", twin("flat"), 2],
  ["drop-coin1", twin("coin1"), 2],
  ["drop-drip", twin("drip"), 2],
  ["drop-pulse1", twin("pulse1"), 1],
  ["drop-pulse2", twin("pulse2"), 1],
];

function sweepProbes(cand) {
  let caught = 0;
  for (const e of Object.values(probes())) {
    const r = compare(cand, e);
    if (r.escaped) caught++;
  }
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at a working dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const e = working();
  assert.notEqual(e ?? null, null, "vacuous: no captured dispatch makes the oracle write game data");
  const r = compare(candidate, e);
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("CORPUS: every dispatch of both tapes replays identically, and not all are no-ops", { skip }, () => {
  for (const e of corpus()) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, `${hex4(e.regs.sp)}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
  }
  const work = corpus().filter((e) => footprint(e) > 0).length;
  assert.ok(work > 0, "no captured dispatch makes the oracle write game data, so the corpus is all no-ops");
  assert.equal(capture({}).length, DISPATCHES_PER_TAPE, "the coin-tape dispatch count moved");
  assert.equal(capture({ tape: [] }).length, DISPATCHES_PER_TAPE, "the attract dispatch count moved");
  console.log(`  CORPUS: ${corpus().length} dispatches identical, ${work} do game-data work`);
});

test("PATHS: each debounce edge and both pulses are reached and replay identically", { skip }, () => {
  const e = edges();
  for (const [label, machine] of Object.entries(e)) {
    const r = compare(candidate, machine);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
  }
  // ★ Vacuity guard: each crafted path must actually move its own cell, or a rewrite that ignored
  // the whole path would pass every arm here.
  const wrote = (machine, addr) => { const before = machine.mem8[addr]; const a = machine.clone(); oracle(a); return a.mem8[addr] !== before; };
  assert.ok(wrote(e.flat, CREDIT_COUNT), "the flat-credit edge did not touch the credit count");
  assert.ok(wrote(e.coin1, COIN1_DEBT), "the coin-1 edge did not touch the coin tally");
  assert.ok(wrote(e.debt, COIN1_TIMER) && wrote(e.debt, COIN2_TIMER), "a pulse did not arm its timer");
  console.log("  PATHS: flat / coin1 / drip edges and the two pulses all identical");
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const e of [working(), ...Object.values(edges())]) {
    const r = compare(candidate, e);
    assert.equal(r.spDiff, 2, "the oracle pops a return the rewrite does not");
    assert.ok(r.retEq, "the return value diverged");
  }
  console.log("  SP: +2 on every path; return values identical");
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of probes`, { skip }, () => {
    const caught = sweepProbes(brokenTwin);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${Object.keys(probes()).length} probes`);
  });
}
