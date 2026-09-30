// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepCountdownSlotThenCloseTurn — memory-equivalent to the frozen oracle at ROM 0x4108.
 * GATE: real dispatches captured when the era-poked tape reaches this arm, plus crafted entries
 *   (captured sweep-body states with the head slot's marker forced to a live count, across the
 *   countdown bands and eras 2-4); the dead stack scratch below the seat masked out; the SP drift
 *   pinned per arm (+2 on both: the rewrite omits the sweep's one ret whether this turn ends the
 *   sweep or its close runs the remaining turns as direct calls); teeth.
 *
 * ★ NO REGISTER IS LIVE AT EXIT, measured on the ORACLE. This arm always leaves through the end of
 *   the whole sweep — its close runs every remaining turn before it returns — so what it leaves in
 *   the cursors, the counter and the stride pair is what the sweep leaves, and wrapped in the
 *   all-frozen game with all of it complemented on the way out it is unheard in every dumped cell over
 *   the countdown-slot session that dispatches it, where SP flipped at the same exit is heard (the
 *   exit-side control) and a poisoned record cursor on its entry is heard at once. (Within the sweep the cursors and the count are handed from turn to turn as arguments.)
 *   The twins that differ from the rewrite only in what they leave in registers on the last turn
 *   are bitten where the sweep goes round again onto an occupied slot.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4108.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stepCountdownSlotThenCloseTurn as candidate } from "../stepCountdownSlotThenCloseTurn.js";
import { loc_4108 as oracle } from "../../translated/loc_4108.js";
import { loc_40ea as sweepBody } from "../../translated/loc_40ea.js";
import { stepDriftingCountdownObjectByEraFrames } from "../stepDriftingCountdownObjectByEraFrames.js";
import { closeOneTurnOfTheSlotSweep } from "../closeOneTurnOfTheSlotSweep.js";
import { ERA_INDEX } from "../names.js";
import { assertDeadAtExit } from "./_deadAtExit.js";

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

// The countdown-slot tape's pokes (JS frames, one later than its lua schedule): the session that
// dispatches this arm through the game's own code, for DEAD AT EXIT.
const COUNTDOWN_SESSION = [{ addr: 0xad14, val: 3, frame: 561, dur: 1 },
  ...Array.from({ length: 19 }, (_, k) => ({ addr: 0xaa81, val: 3, frame: 701 + 16 * k, dur: 1 }))];
const SESSION_FRAMES = 2400;
/** Every register the oracle can leave behind, the stack pointer apart (its return pops through it). */
const LEFT_BEHIND = ["a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];
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
/** BUG: closes first, then steps the slot the close moved on to rather than this one. */
function closeThenStep(m) {
  const { ix, iy } = m.regs;
  const r = closeOneTurnOfTheSlotSweep(m);
  stepDriftingCountdownObjectByEraFrames(m, (ix + 0x10) & 0xffff, (iy + 2) & 0xffff);
  return r;
}
function stepTwice(m) {
  stepDriftingCountdownObjectByEraFrames(m);
  stepDriftingCountdownObjectByEraFrames(m);
  return closeOneTurnOfTheSlotSweep(m);
}

/**
 * Looping entries whose next slot is planted with a drifting object, so a turn that fails to go
 * round (or goes round before stepping) writes different memory.
 */
let looping = null;
function loopingScenarios() {
  if (looping) return looping;
  looping = [];
  for (const e of captured().sweeps) {
    for (const era of ERAS) {
      const m = craft(e, { era, count: 0x30, turns: 3 });
      m.mem8[(m.regs.ix + 0x10 + MARKER_OFFSET) & 0xffff] = 0x30;
      looping.push(m);
    }
  }
  return looping;
}

// [label, twin, the entries it must be caught on]
const TWINS = [
  ["no-op", () => {}, scenarios],
  ["skip-step", skipStep, scenarios],
  ["skip-close", skipClose, loopingScenarios],
  ["close-then-step", closeThenStep, loopingScenarios],
  ["step-twice", stepTwice, scenarios],
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

test("LOOPING ARM: with turns left the whole sweep runs, its one ret omitted as on the ending arm", { skip }, () => {
  let compared = 0;
  for (const e of captured().sweeps) {
    for (const era of ERAS) {
      const r = compare(candidate, craft(e, { era, count: 0x30, turns: 3 }));
      assert.equal(r.escaped, null, r.escaped && `escaped: ${JSON.stringify(r.escaped)}`);
      assert.equal(r.spDiff, 2, "the remaining turns run as direct calls, so the oracle pops the " +
        "sweep's return and the rewrite does not, exactly as on the ending arm");
      compared++;
    }
  }
  assert.ok(compared > 0, "no state to loop");
  console.log(`  LOOPING ARM: ${compared} entries identical, spDiff 2`);
});

test("DEAD AT EXIT: no register the oracle leaves is heard, and the instrument hears one that is read", { skip }, () => {
  assertDeadAtExit({
    at: TARGET, poison: LEFT_BEHIND, frames: SESSION_FRAMES, reachEvery: true,
    sessions: [{ label: "countdown", pokes: COUNTDOWN_SESSION }],
    // A poisoned record cursor on entry is heard in game data: the instrument is not deaf.
    controls: [{ label: "entry IX", poison: ["ix"], before: true, expect: "heard", every: true, dataOnly: true }],
  });
});

for (const [label, twin, entries] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on every entry of the arm it breaks`, { skip }, () => {
    let caught = 0;
    for (const m of entries()) if (compare(twin, m).escaped) caught++;
    assert.ok(entries().length > 0, "no entries to bite on");
    assert.equal(caught, entries().length, `the ${label} twin escaped an entry`);
    console.log(`  TEETH/${label}: caught on ${caught}/${entries().length}`);
  });
}
