// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4d3a — memory-equivalent to the frozen oracle at ROM 0x4D3A. GATE: crafted-entry; the oracle
 *   rets on every exit and the rewrite's dissolved tail does not, so RAM compares with the dead
 *   stack scratch below the seated SP masked, SP drift asserted, registers left alone.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_4d3a as candidate } from "../loc_4d3a.js";
import { loc_4d3a as oracle } from "../../translated/loc_4d3a.js";
import { advanceSexagesimalDigit } from "../advanceSexagesimalDigit.js";
import { applyEraRungSettings } from "../applyEraRungSettings.js";
import { u8 } from "../../../../core/int.js";

const TARGET = 0x4d3a;
const COUNTER = 0xad05;
const RELOAD_TIMER = 0xa9d7;
const RELOAD_VALUE = 0xa9d6;
const ESCALATION_RUNG = 0xacc0;
const TOP_RUNG = 0x0f;

// Every write this routine and its tail make lands at or below here; the stack seats far above it.
const DATA_TOP = 0xadff;
const COINSTART_DISPATCHES = 303;
const ATTRACT_DISPATCHES = 279;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/**
 * Oracle vs candidate on independent clones. The oracle pops the caller's return slot on every
 * exit and the dissolved tail does not, so the diff excludes [low, seat) -- low measured by
 * watching the oracle's own pushes. Anything outside that window has escaped.
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
  oracle(a);
  let threw = null;
  try {
    cand(b);
  } catch (e) {
    threw = e;
  }
  if (threw) return { escaped: { addr: null }, low, seat, spDiff: 0, threw };
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: (((a.regs.sp - b.regs.sp) & 0xffff) << 16) >> 16 };
}

/** Cells the oracle moves from a state, ignoring the stack scratch -- an arm's footprint. */
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

/** The captured entry holds at the first place; the rest are poked onto the deeper arms. */
function scenarios() {
  return [
    ["captured", craft(() => {})],
    ["firstNoWrap", craft((m) => { m.mem8[COUNTER] = 0x10; })],
    ["firstWraps", craft((m) => { m.mem8[COUNTER] = 0x59; m.mem8[COUNTER + 1] = 0x10; m.mem8[RELOAD_TIMER] = 0x0a; })],
    ["thirdDigit", craft((m) => { m.mem8[COUNTER] = 0x59; m.mem8[COUNTER + 1] = 0x59; m.mem8[COUNTER + 2] = 0x10; m.mem8[RELOAD_TIMER] = 0x0a; })],
    ["timerDisabled", craft((m) => { m.mem8[COUNTER] = 0x59; m.mem8[COUNTER + 1] = 0x10; m.mem8[RELOAD_TIMER] = 0x00; })],
    ["timerCounting", craft((m) => { m.mem8[COUNTER] = 0x59; m.mem8[COUNTER + 1] = 0x10; m.mem8[RELOAD_TIMER] = 0x05; })],
    ["timerFires", craft((m) => { m.mem8[COUNTER] = 0x59; m.mem8[COUNTER + 1] = 0x10; m.mem8[RELOAD_TIMER] = 0x01; m.mem8[ESCALATION_RUNG] = 0x05; })],
    ["timerFiresClamp", craft((m) => { m.mem8[COUNTER] = 0x59; m.mem8[COUNTER + 1] = 0x10; m.mem8[RELOAD_TIMER] = 0x01; m.mem8[ESCALATION_RUNG] = 0x0f; })],
  ];
}

/** The rewrite with one deliberate defect each; every knob matches loc_4d3a by default. */
function twin({ chain = "carry", dec = true, clamp = true, tail = true } = {}) {
  return (m) => {
    const { mem8 } = m;
    if (chain === "none") {
      advanceSexagesimalDigit(m, COUNTER);
      return;
    }
    if (chain === "always") {
      advanceSexagesimalDigit(m, COUNTER);
      if (advanceSexagesimalDigit(m, COUNTER + 1)) advanceSexagesimalDigit(m, COUNTER + 2);
    } else {
      if (!advanceSexagesimalDigit(m, COUNTER)) return;
      if (advanceSexagesimalDigit(m, COUNTER + 1)) advanceSexagesimalDigit(m, COUNTER + 2);
    }
    if (mem8[RELOAD_TIMER] === 0) return;
    if (dec) mem8[RELOAD_TIMER] = u8(mem8[RELOAD_TIMER] - 1);
    if (mem8[RELOAD_TIMER] !== 0) return;
    mem8[RELOAD_TIMER] = mem8[RELOAD_VALUE];
    const rung = u8(mem8[ESCALATION_RUNG] + 1);
    mem8[ESCALATION_RUNG] = clamp && rung > TOP_RUNG ? TOP_RUNG : rung;
    if (tail) return applyEraRungSettings(m);
  };
}

const TWINS = [
  ["no-op", () => {}, 8],
  ["no-tail", twin({ tail: false }), 2],
  ["no-clamp", twin({ clamp: false }), 1],
  ["skip-dec", twin({ dec: false }), 5],
  ["no-chain", twin({ chain: "none" }), 6],
  ["always-chain", twin({ chain: "always" }), 2],
];

test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, entryState());
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  // ★ The mask is safe only while its floor sits above every data cell this routine touches.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("PATHS: every arm is memory-equivalent, and the arms really differ", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[label] = footprint(m).join(",");
  }
  // ★ Vacuity guard: the arms must leave DIFFERENT cells, or the pokes changed nothing.
  assert.notEqual(prints.timerDisabled, prints.timerCounting, "the disabled and counting arms move the same cells");
  assert.notEqual(prints.timerCounting, prints.timerFires, "the counting and firing arms move the same cells");
  console.log(`  PATHS: ${scenarios().length} arms equivalent; firing moves ${prints.timerFires.split(",").length} cells`);
});

test("SP: the oracle re-seats two bytes higher on every arm; the product is memory", { skip }, () => {
  for (const [label, m] of scenarios()) {
    assert.equal(compare(candidate, m).spDiff, 2, `${label}: the oracle pops the caller's slot and the rewrite does not`);
  }
  console.log("  SP: +2 on every arm; memory-only live-out held by the masked RAM compare");
});

test("CORPUS: every dispatch replays identically under both tapes", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0;
    let caught = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (compare(candidate, mm).escaped) caught++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
    return { dispatched, caught };
  };
  const coinStart = run({});
  const attract = run({ tape: [] });
  assert.equal(coinStart.dispatched, COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(attract.dispatched, ATTRACT_DISPATCHES, "the attract dispatch count moved");
  assert.equal(coinStart.caught, 0, `diverged on ${coinStart.caught} coin-start dispatches`);
  assert.equal(attract.caught, 0, `diverged on ${attract.caught} attract dispatches`);
  console.log(`  CORPUS: ${coinStart.dispatched} coin-start and ${attract.dispatched} attract dispatches identical`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of arms`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(brokenTwin, m).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} arms`);
  });
}
