// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4108 — memory-equivalent to the frozen oracle at ROM 0x4108.
 * GATE: real dispatches captured when the era-poked tape reaches this arm, plus crafted entries
 *   (captured sweep-body states with the head slot's marker forced to a live count, across the
 *   countdown bands and eras 2-4); the dead stack scratch below the seat masked out; the SP drift
 *   pinned per arm (+2 ending, 0 looping); the oracle-derived live-out registers asserted; teeth.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4108.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_4108 as candidate } from "../loc_4108.js";
import { loc_4108 as oracle } from "../../translated/loc_4108.js";
import { loc_40ea as sweepBody } from "../../translated/loc_40ea.js";
import { stepDriftingCountdownObjectByEraFrames } from "../stepDriftingCountdownObjectByEraFrames.js";
import { closeOneTurnOfTheSlotSweep } from "../closeOneTurnOfTheSlotSweep.js";
import { ERA_INDEX } from "../names.js";

const TARGET = 0x4108;
const SWEEP_BODY = 0x40ea;

const MARKER_OFFSET = 0x00;
// Every count this arm can see (0 and 0xFF are diverted before it), chosen to straddle the
// retire, animation-window and reset bands of the per-frame step.
const COUNTS = [0x01, 0x02, 0x1b, 0x1c, 0x1d, 0x30, 0x3b, 0x3c, 0x3d, 0x80, 0xfe];
const ERAS = [2, 3, 4];
const POKE_FROM_FRAME = 900;

// The oracle's stack floor sits far above game data; asserted per run.
const DATA_TOP = 0xadff;
const CORPUS = 30;

// Live-out the oracle leaves for the sweep: both cursors, the counter and the stride pair.
const LIVE_OUT = ["ix", "iy", "b", "d", "e"];
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── capture ────────────────────────────────────────────────────────────────────────────────

let cap = null;
function captured() {
  if (cap) return cap;
  const sweeps = [];
  const real = [];
  let realSeen = 0;
  const strip = (mm) => { mm.assets = {}; mm.video = null; return mm; };
  const m = makeMachine(new Map([
    [SWEEP_BODY, (mm) => {
      if (sweeps.length < CORPUS) sweeps.push(strip(mm.clone()));
      return sweepBody(mm);
    }],
    [TARGET, (mm) => {
      realSeen++;
      if (real.length < CORPUS) real.push(strip(mm.clone()));
      return oracle(mm);
    }],
  ]));
  m.pokes = [{ addr: ERA_INDEX, val: 2, frame: POKE_FROM_FRAME, dur: null }];
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  cap = { sweeps, real, realSeen };
  return cap;
}

/** A captured sweep-body state with its head slot forced into this arm: a live count. */
function craft(base, { era, count, turns = 1 }) {
  const m = base.clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[(m.regs.ix + MARKER_OFFSET) & 0xffff] = count;
  m.regs.b = turns;
  return m;
}

let crafted = null;
function scenarios() {
  if (crafted) return crafted;
  crafted = [];
  for (const e of captured().sweeps) {
    for (const era of ERAS) for (const count of COUNTS) crafted.push(craft(e, { era, count }));
  }
  return crafted;
}

// ── comparison ─────────────────────────────────────────────────────────────────────────────

/** Oracle vs candidate on clones; [floor, seat) is the stack scratch only the oracle threads. */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let floor = seat;
  const pushA = a.push16.bind(a);
  a.push16 = (v) => { pushA(v); if (a.regs.sp < floor) floor = a.regs.sp; };
  const pushB = b.push16.bind(b);
  b.push16 = (v) => { pushB(v); if (b.regs.sp < floor) floor = b.regs.sp; };
  oracle(a);
  try { cand(b); } catch (e) {
    return { escaped: { addr: null, note: String(e).slice(0, 60) }, floor, seat, spDiff: null };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= floor && addr < seat) continue;
    escaped = { addr, a: da[i], b: db[i] };
  }
  if (!escaped) {
    const k = LIVE_OUT.find((r) => a.regs[r] !== b.regs[r]);
    if (k) escaped = { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return { escaped, floor, seat, spDiff: a.regs.sp - b.regs.sp };
}

/** Bytes the oracle moves in game data from a state. */
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

// ── twins ──────────────────────────────────────────────────────────────────────────────────

function skipStep(m) { return closeOneTurnOfTheSlotSweep(m); }
function skipClose(m) { stepDriftingCountdownObjectByEraFrames(m); }
function closeThenStep(m) {
  const r = closeOneTurnOfTheSlotSweep(m);
  stepDriftingCountdownObjectByEraFrames(m);
  return r;
}
function stepTwice(m) {
  stepDriftingCountdownObjectByEraFrames(m);
  stepDriftingCountdownObjectByEraFrames(m);
  return closeOneTurnOfTheSlotSweep(m);
}
function movesLiveOut(m) {
  const r = candidate(m);
  m.regs.iy = (m.regs.iy + 1) & 0xffff;
  return r;
}

const TWINS = [
  ["no-op", () => {}],
  ["skip-step", skipStep],
  ["skip-close", skipClose],
  ["close-then-step", closeThenStep],
  ["step-twice", stepTwice],
  ["moves-live-out", movesLiveOut],
];

// ── gate ───────────────────────────────────────────────────────────────────────────────────

test("REAL: every captured dispatch of this arm is equivalent", { skip }, () => {
  const { sweeps, real, realSeen } = captured();
  assert.ok(sweeps.length > 0, "the sweep body never ran in-era, so the tap proves nothing");
  for (const m of real) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, r.escaped && `escaped: ${JSON.stringify(r.escaped)}`);
    assert.ok(r.floor > DATA_TOP, `the stack window ${hex4(r.floor)} reached into game data`);
  }
  console.log(`  REAL: ${hex4(TARGET)} entered ${realSeen} times, ${real.length} compared; ` +
    `${sweeps.length} ${hex4(SWEEP_BODY)} states as the control`);
});

test("ENDING ARM: crafted entries equivalent, the return popped, the mask above data", { skip }, () => {
  let footprints = 0;
  for (const m of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, r.escaped && `escaped at ${hex4(r.escaped.addr ?? 0)}: ${JSON.stringify(r.escaped)}`);
    assert.equal(r.spDiff, 2, "the oracle pops the sweep's return and the rewrite does not");
    assert.ok(r.floor > DATA_TOP, `the stack window ${hex4(r.floor)} reached into game data`);
    if (footprint(m) > 0) footprints++;
  }
  assert.ok(footprints > 0, "vacuous: the oracle writes nothing on any crafted entry");
  console.log(`  ENDING ARM: ${scenarios().length} entries identical, ${footprints} with a footprint`);
});

test("LOOPING ARM: with turns left the whole sweep runs and the return balances", { skip }, () => {
  let compared = 0;
  for (const e of captured().sweeps) {
    for (const era of ERAS) {
      const r = compare(candidate, craft(e, { era, count: 0x30, turns: 3 }));
      assert.equal(r.escaped, null, r.escaped && `escaped: ${JSON.stringify(r.escaped)}`);
      assert.equal(r.spDiff, 0, "the looping arm re-enters the sweep and its ret balances the seat");
      compared++;
    }
  }
  assert.ok(compared > 0, "no state to loop");
  console.log(`  LOOPING ARM: ${compared} entries identical, spDiff 0`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on every crafted entry`, { skip }, () => {
    let caught = 0;
    for (const m of scenarios()) if (compare(twin, m).escaped) caught++;
    assert.equal(caught, scenarios().length, `the ${label} twin escaped an entry`);
    console.log(`  TEETH/${label}: caught on ${caught}/${scenarios().length}`);
  });
}
