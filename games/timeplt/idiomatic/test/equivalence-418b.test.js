// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyLiveSlotAndTickCountdown — memory-equivalent to the frozen oracle at ROM 0x418B.
 * GATE: crafted entries (real sweep-body states with one slot forced into this arm — marker full,
 *   countdown live, era not the fourth), the dead stack scratch below the seat masked out, the SP
 *   drift asserted per arm (+2 on both: the rewrite omits the sweep's one ret whether this turn ends
 *   the sweep or its close runs the remaining turns as direct calls), and teeth.
 *
 * ★ NO REGISTER IS LIVE AT EXIT, measured on the ORACLE. This arm always leaves through the end of
 *   the whole sweep — its close runs every remaining turn before it returns — so what it leaves is
 *   what the sweep leaves, and wrapped in the all-frozen game with every register it can leave
 *   complemented on the way out it is unheard in every dumped cell over the era-3 and countdown-slot
 *   sessions that dispatch it, where SP flipped at the same exit is heard (the exit-side control) and
 *   a poisoned record cursor on its entry is heard at once. (Within the
 *   sweep the cursors and the count are handed from turn to turn as arguments.) The twin that
 *   differs only in never going round is bitten where the sweep goes round onto an occupied slot.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-418b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyLiveSlotAndTickCountdown as candidate } from "../flyLiveSlotAndTickCountdown.js";
import { loc_418b as oracle } from "../../translated/loc_418b.js";
import { loc_40ea as sweepBody } from "../../translated/loc_40ea.js";
import { closeOneTurnOfTheSlotSweep } from "../closeOneTurnOfTheSlotSweep.js";
import { flyAndRetireSlotCyclingShapeInEra4 } from "../flyAndRetireSlotCyclingShapeInEra4.js";
import { ERA_INDEX } from "../names.js";
import { assertDeadAtExit } from "./_deadAtExit.js";

const TARGET = 0x418b;
const SWEEP_BODY = 0x40ea;

const MARKER_OFFSET = 0x00;
const COUNTDOWN_OFFSET = 0x0e;
const SLOT_FULL = 0xff;

// The sweep runs only from the third era up; the fourth diverts this slot elsewhere, so 2 and 3 are
// the only eras that reach this arm. Poke from a frame the coin-start tape has left attract.
const ERA_WITH_SWEEP = 2;
const FOURTH_ERA = 4;
const POKE_FROM_FRAME = 900;

// Measured: the oracle's stack reach floor sits at 0xAFE0 and game data tops out far below here, so a
// window bounded above this can never hide a real write. Asserted against the live floor per run.
const DATA_TOP = 0xadff;
const CORPUS = 200;

// The sessions that dispatch this arm through the game's own code (JS frames, one later than a lua
// schedule's): the third era held, and the countdown-slot tape's pokes.
const SESSION_FRAMES = 2400;
const SESSIONS = {
  "era 3": [{ addr: ERA_INDEX, val: 3, frame: POKE_FROM_FRAME, dur: null }],
  countdown: [{ addr: 0xad14, val: 3, frame: 561, dur: 1 },
    ...Array.from({ length: 19 }, (_, k) => ({ addr: 0xaa81, val: 3, frame: 701 + 16 * k, dur: 1 }))],
};
/** Every register the oracle can leave behind, the stack pointer apart (its return pops through it). */
const LEFT_BEHIND = ["a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the captured sweep-body states, and the crafted slot ──────────────────────────────────

let raw = null;
function captured() {
  if (raw) return raw;
  const entries = [];
  const m = makeMachine(new Map([[SWEEP_BODY, (mm) => {
    if (entries.length < CORPUS) {
      mm.assets = {};
      mm.video = null;
      entries.push(mm.clone());
    }
    return sweepBody(mm);
  }]]));
  m.pokes = [{ addr: ERA_INDEX, val: ERA_WITH_SWEEP, frame: POKE_FROM_FRAME, dur: null }];
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  raw = entries;
  return raw;
}

/** A captured sweep-body state with its head slot forced into this arm's precondition. */
function craft(base, { era = ERA_WITH_SWEEP, count = 1, cd = 3 } = {}) {
  const m = base.clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[(m.regs.ix + MARKER_OFFSET) & 0xffff] = SLOT_FULL;
  m.mem8[(m.regs.ix + COUNTDOWN_OFFSET) & 0xffff] = cd;
  m.regs.b = count;
  return m;
}

function scenarios() {
  return captured().map((e) => craft(e));
}

// ── comparison ────────────────────────────────────────────────────────────────────────────

/**
 * Oracle vs candidate on independent clones. The oracle threads its work through the stack and the
 * rewrite does not, so [floor, seat) — floor being the deepest either side pushed — is masked.
 */
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
  let threw = null;
  try { cand(b); } catch (e) { threw = String(e).slice(0, 60); }
  if (threw) return { escaped: { addr: null, note: threw }, floor, seat, spDiff: null };
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

/** Bytes the oracle moves outside the stack from a state — the crafted entry's footprint. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  const seat = a.regs.sp;
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

/** Looping entries whose next slot is planted with a drifting object, so a turn that never goes round shows. */
function loopingScenarios() {
  return captured().map((e) => {
    const m = craft(e, { count: 3 });
    m.mem8[(m.regs.ix + 0x10 + MARKER_OFFSET) & 0xffff] = 0x30;
    return m;
  });
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────

function skip3e6c(m) {
  const addr = (m.regs.ix + COUNTDOWN_OFFSET) & 0xffff;
  m.mem8[addr] = m.mem8[addr] - 1;
  return closeOneTurnOfTheSlotSweep(m);
}
function skipCountdown(m) {
  flyAndRetireSlotCyclingShapeInEra4(m);
  return closeOneTurnOfTheSlotSweep(m);
}
function wrongCountdownCell(m) {
  flyAndRetireSlotCyclingShapeInEra4(m);
  const addr = (m.regs.ix + COUNTDOWN_OFFSET - 1) & 0xffff;
  m.mem8[addr] = m.mem8[addr] - 1;
  return closeOneTurnOfTheSlotSweep(m);
}
function skipCloseTurn(m) {
  flyAndRetireSlotCyclingShapeInEra4(m);
  const addr = (m.regs.ix + COUNTDOWN_OFFSET) & 0xffff;
  m.mem8[addr] = m.mem8[addr] - 1;
}
// [label, twin, the entries it must be caught on]
const TWINS = [
  ["no-op", () => {}, scenarios],
  ["skip-fly", skip3e6c, scenarios],
  ["skip-countdown", skipCountdown, scenarios],
  ["wrong-countdown-cell", wrongCountdownCell, scenarios],
  ["skip-close-turn", skipCloseTurn, loopingScenarios],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHABILITY: no tape dispatches this arm, with the sweep body as the control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [SWEEP_BODY]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [SWEEP_BODY, (mm) => { seen[SWEEP_BODY]++; return sweepBody(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    assert.equal(seen[TARGET], 0, `${label} now dispatches this arm; capture plain entries instead`);
  }
  // ★ The zero above is a finding only because the same tap counts the sweep body in-era: without
  // that positive control an arm the game never enters is indistinguishable from a dead tap.
  assert.ok(captured().length > 0, "the sweep body never ran even in-era, so the tap proves nothing");
  console.log(`  REACHABILITY: ${hex4(TARGET)} entered 0 times; ${captured().length} in-era ` +
    `${hex4(SWEEP_BODY)} states captured as the control`);
});

test("ENDING ARM: crafted entries equivalent, the return popped, the mask above data", { skip }, () => {
  let footprints = 0;
  for (const m of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, r.escaped && `escaped at ${hex4(r.escaped.addr ?? 0)}: ${JSON.stringify(r.escaped)}`);
    assert.equal(r.spDiff, 2, "the oracle pops the sweep's return and the rewrite does not");
    // ★ The mask is safe only while its floor stays above every data cell.
    assert.ok(r.floor > DATA_TOP, `the stack window ${hex4(r.floor)} reached into game data`);
    if (footprint(m) > 0) footprints++;
  }
  assert.ok(footprints > 0, "vacuous: the oracle writes nothing on any crafted entry");
  console.log(`  ENDING ARM: ${scenarios().length} entries identical, ${footprints} with a footprint`);
});

test("LOOPING ARM: with turns left the whole sweep runs, its one ret omitted as on the ending arm", { skip }, () => {
  let compared = 0;
  for (const e of captured()) {
    const r = compare(candidate, craft(e, { count: 3 }));
    assert.equal(r.escaped, null, r.escaped && `escaped: ${JSON.stringify(r.escaped)}`);
    assert.equal(r.spDiff, 2, "the remaining turns run as direct calls, so the oracle pops the " +
      "sweep's return and the rewrite does not, exactly as on the ending arm");
    compared++;
  }
  assert.ok(compared > 0, "no state to loop");
  console.log(`  LOOPING ARM: ${compared} entries identical, spDiff 2`);
});

test("ERA: the third era also reaches this arm; the fourth is diverted before it", { skip }, () => {
  for (const e of captured()) {
    const r = compare(candidate, craft(e, { era: 3, cd: 5 }));
    assert.equal(r.escaped, null, r.escaped && `escaped: ${JSON.stringify(r.escaped)}`);
  }
  assert.notEqual(ERA_WITH_SWEEP, FOURTH_ERA, "the fourth era never reaches this arm; not crafted here");
  console.log("  ERA: era 2 and era 3 identical");
});

test("DEAD AT EXIT: no register the oracle leaves is heard, and the instrument hears one that is read", { skip }, () => {
  assertDeadAtExit({
    at: TARGET, poison: LEFT_BEHIND, frames: SESSION_FRAMES, reachEvery: true,
    sessions: Object.entries(SESSIONS).map(([label, pokes]) => ({ label, pokes })),
    // A poisoned record cursor on entry is heard in game data in every session: the instrument is not deaf.
    controls: [{ label: "entry IX", poison: ["ix"], before: true, expect: "heard", every: true, dataOnly: true }],
  });
});

for (const [label, twin, entries] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on every entry of the arm it breaks`, { skip }, () => {
    const list = entries();
    let caught = 0;
    for (const m of list) if (compare(twin, m).escaped) caught++;
    assert.ok(list.length > 0, "no entries to bite on");
    assert.equal(caught, list.length, `the ${label} twin escaped an entry`);
    console.log(`  TEETH/${label}: caught on ${caught}/${list.length}`);
  });
}
