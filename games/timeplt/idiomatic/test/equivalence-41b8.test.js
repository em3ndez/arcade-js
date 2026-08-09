// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_41b8 — memory-equivalent to the frozen oracle at ROM 0x41B8.
 * GATE: era-poked real dispatches (the tapes never reach it) plus crafted re-aim and arrival
 *   entries. RAM compared with the dead stack scratch below the seat masked out (the oracle nests
 *   calls and tail-rets, the rewrite does not), the +2 SP drift asserted, and the two live-outs the
 *   ROM form leaves checked: the retire carry and the passed-through BC. Other registers are not
 *   compared -- the dissolved callees drop the register dance. Teeth below.
 *   Run: node --test games/timeplt/idiomatic/test/equivalence-41b8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_41b8 as candidate } from "../loc_41b8.js";
import { loc_41b8 as oracle } from "../../translated/loc_41b8.js";
import { headingToward } from "../headingToward.js";
import { endApproachNow } from "../endApproachNow.js";
import { steerTowardAimAtFixedRate } from "../steerTowardAimAtFixedRate.js";
import { loc_58b6 } from "../loc_58b6.js";
import { animateFixedShapeCycleAtHalfRate } from "../animateFixedShapeCycleAtHalfRate.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { u8, u16 } from "../../../../core/int.js";

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

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/** Oracle vs candidate on clones: RAM diffed outside [lowestSp, seat), the SP drift, and the two
 * live-outs the ROM form actually hands back -- the retire carry and BC. */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  cand(b);
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
    carryOracle: a.regs.f & F_C, carryCand: b.regs.f & F_C,
    bcOracle: a.regs.bc, bcCand: b.regs.bc,
  };
}

const diverged = (r) =>
  r.escaped !== null || r.spDiff !== 2 || r.carryOracle !== r.carryCand || r.bcOracle !== r.bcCand;

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

const scenarios = () => [
  ["nonreaim", nonReaimBase().clone()],
  ["reaim-clear", craftReaim(false, false)],
  ["reaim-set", craftReaim(true, false)],
  ["arrive-clear", craftReaim(false, true)],
  ["arrive-set", craftReaim(true, true)],
];

// ── the twins ─────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every knob matches loc_41b8 by default. */
function twin({ reaim = true, swap = false, end = true, bc = true, move = true }) {
  return (m) => {
    const { regs, mem8 } = m;
    const held = regs.bc;
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
    animateFixedShapeCycleAtHalfRate(m);
    if (bc) regs.bc = held;
    return hasReachedRetireLine(m);
  };
}

const TWINS = [
  ["no-op", () => {}, 5],
  ["skip-reaim", twin({ reaim: false }), 4],
  ["swap-aim-points", twin({ swap: true }), 4],
  ["skip-arrival-cutoff", twin({ end: false }), 2],
  ["forget-bc", twin({ bc: false }), 5],
  ["skip-move", twin({ move: false }), 5],
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
    assert.ok(!diverged(r), r.escaped ? `diverged at ${hex4(r.escaped.addr)}` : "sp/carry/bc diverged");
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
  console.log("  SCENARIOS: 5 paths equivalent; both arrival paths cut the countdown to 0");
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
