// SPDX-License-Identifier: GPL-3.0-only
/**
 * flyTowardShipStandoffThenEndApproach — memory-equivalent to the frozen oracle at ROM 0x41B8.
 * GATE: era-poked real dispatches (the tapes never reach it) plus crafted re-aim and arrival
 *   entries. RAM compared with the dead stack scratch below the seat masked out (the oracle nests
 *   calls and tail-rets, the rewrite does not), the +2 SP drift asserted, and the retire verdict the
 *   ROM form leaves in the carry held equal to the one the rewrite RETURNS. Teeth below.
 *
 * ★ NO REGISTER IS LIVE AT EXIT but the sweep count and cursors, and those are handed back untouched
 *   — measured on the ORACLE. The ROM form passes BC, IX and IY through (HANDED BACK: over every
 *   dispatch and crafted path the oracle returns them exactly as it got them), because its caller's
 *   turn-closer reads the count and both cursors next; the rewrite's caller holds them as locals and
 *   hands them to the turn-closer itself, so this routine carries no BC and takes the cursors as
 *   arguments. Every other register it leaves — the carry
 *   included — is unheard over the held-era session, but for its pushed copy in one register-save
 *   slot (PUSHED_SAVE_SLOTS), when complemented on
 *   the way out (assertDeadAtExit); a complemented B is heard in game data at once, so the
 *   instrument is not deaf.
 *   Run: node --test games/timeplt/idiomatic/test/equivalence-41b8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { flyTowardShipStandoffThenEndApproach as candidate } from "../flyTowardShipStandoffThenEndApproach.js";
import { loc_41b8 as oracle } from "../../translated/loc_41b8.js";
import { headingToward } from "../headingToward.js";
import { endApproachNow } from "../endApproachNow.js";
import { steerTowardAimAtFixedRate } from "../steerTowardAimAtFixedRate.js";
import { loc_58b6 } from "../loc_58b6.js";
import { animateFixedShapeCycleFromShape50 } from "../animateFixedShapeCycleFromShape50.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { u8, u16 } from "../../../../core/int.js";
import { assertDeadAtExit } from "./_deadAtExit.js";
import { ROUTINES } from "../names.js";

const TARGET = 0x41b8;
const ERA_INDEX = 0xad04;
const FRAME_TICK = 0xa980;
const POKE_FROM = 550;
const F_C = 0x01;

const AIM_POINT_SET = 0xac75;
const AIM_POINT_CLEAR = 0xac79;
const SELECTOR_OFFSET = 15;
const HEADING_OFFSET = 1;
const COUNTDOWN_OFFSET = 4;
const SECOND_COORD = 49;
const ARRIVED = 16;
const SENTINEL = 0xee;
const LIVE_COUNTDOWN = 0x21;

// The stack seats at 0xB000; every write this routine and its callees make lands at or below here.
const DATA_TOP = 0xadff;

// The session DEAD AT EXIT poisons over: the era held at 4 from the corpus's own frame.
const SESSION = [{ frame: POKE_FROM, addr: ERA_INDEX, val: 4, dur: null }];
const SESSION_FRAMES = 2400;
/** What the caller's turn-closer reads next: the count and the two cursors, all handed back untouched. */
const HANDED_BACK = ["bc", "ix", "iy"];
/** Every other register the oracle can leave behind, the stack pointer apart. */
const LEFT_BEHIND = ["a", "f", "c", "d", "e", "h", "l", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/** Oracle vs candidate on clones: RAM diffed outside [lowestSp, seat), the SP drift, and the retire
 * verdict -- the oracle's carry against the rewrite's returned value. */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  const verdict = cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return {
    escaped, low, seat,
    spDiff: a.regs.sp - b.regs.sp,
    carryOracle: (a.regs.f & F_C) !== 0, verdict: verdict === true,
  };
}

const diverged = (r) => r.escaped !== null || r.spDiff !== 2 || r.carryOracle !== r.verdict;

/** Cells the oracle moves at or below the data ceiling -- an entry's footprint. */
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

// ── captured and crafted entries ──────────────────────────────────────────────────────────

let poked = null;
/** Real dispatches: the tapes never reach here, so hold the era at 4 and let the ROM arrive. */
function capturePoked() {
  if (poked) return poked;
  const entries = [];
  let collecting = true;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting) entries.push(mm.clone());
    return oracle(mm);
  }]]), {});
  m.pokes = [{ frame: POKE_FROM, addr: ERA_INDEX, val: 4 }];
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the poked run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the poked run ran short");
  poked = entries;
  return poked;
}

const reaimBase = () => capturePoked().find((e) => (e.mem8[FRAME_TICK] & 0x0f) === 0);
const nonReaimBase = () => capturePoked().find((e) => (e.mem8[FRAME_TICK] & 0x0f) !== 0);

/** A re-aim entry with the two aim points made distinct so which is chosen shows in the heading;
 * `arrive` puts the object on the chosen point (both gaps 0) over a live countdown to be cut. */
function craftReaim(bitSet, arrive) {
  const e = reaimBase().clone();
  const ix = e.regs.ix;
  const iy = e.regs.iy;
  if (bitSet) e.mem8[u16(ix + SELECTOR_OFFSET)] |= 1;
  else e.mem8[u16(ix + SELECTOR_OFFSET)] &= ~1;
  e.mem8[AIM_POINT_SET] = 0x40; e.mem8[AIM_POINT_SET - 1] = 0x80;
  e.mem8[AIM_POINT_CLEAR] = 0xc0; e.mem8[AIM_POINT_CLEAR - 1] = 0x80;
  const point = bitSet ? AIM_POINT_SET : AIM_POINT_CLEAR;
  if (arrive) {
    e.mem8[iy] = e.mem8[point];
    e.mem8[u16(iy + SECOND_COORD)] = e.mem8[(point & 0xff00) | u8(point - 1)];
    e.mem8[u16(ix + COUNTDOWN_OFFSET)] = LIVE_COUNTDOWN;
  } else {
    e.mem8[iy] = 0; e.mem8[u16(iy + SECOND_COORD)] = 0;
    e.mem8[u16(ix + HEADING_OFFSET)] = SENTINEL;
  }
  return e;
}

/**
 * A non-re-aim entry whose object ends its move on a retire line, so the verdict is TRUE and a
 * rewrite that drops it shows: the first column value (searched, on the oracle) that leaves the
 * oracle's carry set.
 */
function craftRetiring() {
  for (let column = 0; column < 0x100; column++) {
    const e = nonReaimBase().clone();
    e.mem8[e.regs.iy] = column;
    const a = e.clone();
    oracle(a);
    if (a.regs.f & F_C) return e;
  }
  throw new Error("no column puts the object on a retire line");
}

const scenarios = () => [
  ["nonreaim", nonReaimBase().clone()],
  ["retiring", craftRetiring()],
  ["reaim-clear", craftReaim(false, false)],
  ["reaim-set", craftReaim(true, false)],
  ["arrive-clear", craftReaim(false, true)],
  ["arrive-set", craftReaim(true, true)],
];

// ── the twins ─────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every knob matches flyTowardShipStandoffThenEndApproach by default. */
function twin({ reaim = true, swap = false, end = true, move = true }) {
  return (m) => {
    const { regs, mem8 } = m;
    if (reaim && (mem8[FRAME_TICK] & 0x0f) === 0) {
      const setP = swap ? AIM_POINT_CLEAR : AIM_POINT_SET;
      const clrP = swap ? AIM_POINT_SET : AIM_POINT_CLEAR;
      const point = mem8[u16(regs.ix + SELECTOR_OFFSET)] & 1 ? setP : clrP;
      mem8[u16(regs.ix + HEADING_OFFSET)] = headingToward(m, point);
      const g1 = Math.abs(mem8[point] - mem8[regs.iy]);
      const g2 = Math.abs(mem8[(point & 0xff00) | u8(point - 1)] - mem8[u16(regs.iy + SECOND_COORD)]);
      if (end && g1 < ARRIVED && g2 < ARRIVED) endApproachNow(m, regs.ix);
    }
    steerTowardAimAtFixedRate(m);
    if (move) loc_58b6(m);
    animateFixedShapeCycleFromShape50(m);
    return hasReachedRetireLine(m);
  };
}

const TWINS = [
  ["no-op", () => {}, 6],
  ["skip-reaim", twin({ reaim: false }), 4],
  ["swap-aim-points", twin({ swap: true }), 4],
  ["skip-arrival-cutoff", twin({ end: false }), 2],
  ["skip-verdict", (m) => { candidate(m); }, 1],
  ["skip-move", twin({ move: false }), 6],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: neither tape dispatches this address, with the era-poke tap as control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    let seen = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => { seen++; return oracle(mm); }]]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    assert.equal(seen, 0, `${label} now dispatches this address, so capture it plainly instead`);
  }
  // ★ The zeros are absence only because the identical tap DOES fire once the era is held.
  assert.ok(capturePoked().length > 0, "the tap never fired even under the era poke; instrument dead");
  console.log(`  UNREACHED: coin-start & undriven 0; era-poked ${capturePoked().length}`);
});

test("POKED DISPATCH: era held at 4, every real dispatch replays identically", { skip }, () => {
  const entries = capturePoked();
  assert.ok(entries.length > 0, "vacuous: holding the era at 4 no longer reaches this address");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.ok(!diverged(r), r.escaped ? `diverged at ${hex4(r.escaped.addr)}` : "sp/verdict diverged");
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
  }
  const prints = entries.map(footprint);
  assert.ok(prints.some((n) => n > 0), "every dispatch moves nothing, so a no-op rewrite would pass");
  console.log(`  POKED: ${entries.length} real dispatches identical`);
});

test("SCENARIOS: every crafted path is equivalent, and arrival really cuts the countdown", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.ok(!diverged(r), `${label} diverged${r.escaped ? " at " + hex4(r.escaped.addr) : ""}`);
    assert.ok(r.low > DATA_TOP, `${label}: the mask window reached game data`);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops the tail ret and the rewrite does not`);
  }
  // ★ Vacuity: the arrival paths must really zero a live countdown, or skip-arrival-cutoff is toothless.
  for (const [label, bitSet] of [["arrive-clear", false], ["arrive-set", true]]) {
    const m = craftReaim(bitSet, true);
    const cell = u16(m.regs.ix + COUNTDOWN_OFFSET);
    assert.notEqual(m.mem8[cell], 0, `${label} started with an already-zero countdown`);
    const a = m.clone();
    oracle(a);
    assert.equal(a.mem8[cell], 0, `${label} did not cut the countdown`);
  }
  const retiring = scenarios().find(([label]) => label === "retiring")[1].clone();
  oracle(retiring);
  assert.ok(retiring.regs.f & F_C, "the retiring path does not end on a retire line, so the verdict is untested");
  console.log(`  SCENARIOS: ${scenarios().length} paths equivalent; both arrival paths cut the countdown to 0; ` +
    "the retiring path's verdict is true");
});

test("HANDED BACK: the oracle returns the count and both cursors its caller's turn-closer reads, untouched", { skip }, () => {
  const entries = [...capturePoked(), ...scenarios().map(([, m]) => m)];
  const moved = entries.filter((e) => {
    const a = e.clone();
    oracle(a);
    return HANDED_BACK.some((k) => a.regs[k] !== e.regs[k]);
  });
  assert.equal(moved.length, 0, "the oracle hands back a changed BC, so the caller's own count is not " +
    "its live-out and the rewrite's caller is wrong to keep it");
  // The measurement can see a BC that is not handed back: the rewrite carries no BC, and its callees
  // leave one behind.
  const control = entries.filter((e) => { const b = e.clone(); candidate(b); return b.regs.bc !== e.regs.bc; });
  assert.ok(control.length > 0, "the measurement sees nothing even on a routine that does not restore BC");
  // The hand-back is safe only while its frozen readers never run: the caller 0x4194 and the turn-closer
  // 0x410B it jumps to must both be replaced by overrides that take the count and cursors as arguments.
  for (const reader of [0x4194, 0x410b]) {
    assert.ok(ROUTINES[reader] !== undefined, `${hex4(reader)} reads the handed-back registers and is frozen, so the ` +
      "rewrite's moved count would reach it");
  }
  console.log(`  HANDED BACK: BC unchanged by the oracle on all ${entries.length}; the rewrite moves it on ${control.length}`);
});

/** Stack-page slots the frozen code pushes register saves through (each is a push16 slot in the
 * all-frozen session): a poisoned register shows here as a pushed copy and nowhere else. Measured by the
 * DEAD AT EXIT arm, which lets exactly these through and nothing else. */
const PUSHED_SAVE_SLOTS = [0xafe0];

test("DEAD AT EXIT: no other register the oracle leaves is heard; the count is", { skip }, () => {
  // assertDeadAtExit: nothing differs but the pushed copy in PUSHED_SAVE_SLOTS; the count, poisoned
  // at the same exit, must be heard in game data (dataOnly), not only as pushed scratch on the stack page.
  assertDeadAtExit({
    at: TARGET, poison: LEFT_BEHIND, frames: SESSION_FRAMES, reachEvery: true,
    scratch: PUSHED_SAVE_SLOTS,
    sessions: [{ label: "held era", pokes: SESSION }],
    controls: [{ label: "count", poison: ["b"], expect: "heard", every: true, dataOnly: true }],
  });
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (diverged(compare(brokenTwin, m))) caught++;
    assert.ok(expected > 0, `the ${label} twin catches nothing`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length}`);
  });
}
