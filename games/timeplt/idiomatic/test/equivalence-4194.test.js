// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepSlotApproachThenBreakawayRetire — equivalence gate. The address is unreached under both tapes because it needs the
 * fifth era, so entries come from a run holding the era cell there; RAM is compared with the dead
 * stack scratch below the seat masked, the SP re-seat and return checked, plus teeth.
 *
 * ★ NO REGISTER IS LIVE AT EXIT, measured on the ORACLE. This handler always leaves through the end
 * of the whole sweep — its close runs every remaining turn before it returns — so what it leaves in
 * the sweep cursors, the count and the object-work scratch is what the sweep leaves; wrapped in the
 * all-frozen game with every register it can leave complemented on the way out, it is unheard in
 * every dumped cell over the held-era session that dispatches it, where SP flipped at the same exit is
 * heard (the exit-side control) and a poisoned record cursor on its entry is heard at once. (Within
 * the sweep the cursors and the count are handed from turn to turn as arguments, so a rewrite that
 * drops the count is caught in memory, where the sweep goes wrong.)
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4194.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stepSlotApproachThenBreakawayRetire as candidate } from "../stepSlotApproachThenBreakawayRetire.js";
import { loc_4194 as oracle } from "../../translated/loc_4194.js";
import { loc_40ea as dispatchSite } from "../../translated/loc_40ea.js";
import { loc_40d6 as sweepEntry } from "../../translated/loc_40d6.js";
import { loc_58b6 } from "../loc_58b6.js";
import { animateFixedShapeCycleAtHalfRate } from "../animateFixedShapeCycleAtHalfRate.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { retireSlot } from "../retireSlot.js";
import { closeOneTurnOfTheSlotSweep } from "../closeOneTurnOfTheSlotSweep.js";
import { flyTowardShipStandoffThenEndApproach } from "../flyTowardShipStandoffThenEndApproach.js";
import { ERA_INDEX, OPENING_ERA_VELOCITY_TABLE } from "../names.js";
import { flyAlongHeadingAtDoubleVelocity } from "../flyAlongHeadingAtDoubleVelocity.js";
import { assertDeadAtExit } from "./_deadAtExit.js";

const TARGET = 0x4194;
const DISPATCH_SITE = 0x40ea;
const SWEEP_ENTRY = 0x40d6;
const FIFTH_ERA = 4;
const POKE_FROM = 520;
const COUNTDOWN = 4;
// Every game-data write this routine makes lands here or below; the stack seats above it, so the
// masked window can never hide one. Asserted against the measured floor in POKED DISPATCH.
const DATA_TOP = 0xadff;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// The session DEAD AT EXIT poisons over: the era held at five from the same frame the corpus uses.
const SESSION = [{ frame: POKE_FROM, addr: ERA_INDEX, val: FIFTH_ERA, dur: null }];
const SESSION_FRAMES = 2400;
/** Every register the oracle can leave behind, the stack pointer apart (its return pops through it). */
const LEFT_BEHIND = ["a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/**
 * Oracle vs a candidate on independent clones. The oracle writes return addresses into the stack
 * scratch the rewrite never touches, so the diff excludes [low, seat) with low the oracle's own
 * deepest push. Anything outside that window has escaped.
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
  let retCand;
  try {
    retCand = cand(b);
  } catch {
    return { escaped: -1, low, seat, spDiff: 0, retOracle, retCand: "threw" };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = addr;
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

// ── the captured entries ──────────────────────────────────────────────────────────────────

let poked = null;
function capturePoked() {
  if (poked) return poked;
  const entries = [];
  let collecting = true;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  m.pokes = [{ frame: POKE_FROM, addr: ERA_INDEX, val: FIFTH_ERA }];
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the poked run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the poked run ran short");
  poked = entries;
  return poked;
}

/** The corpus split by branch, and which zero-branch dispatches reach a retire line. */
function classify() {
  const zero = [];
  const running = [];
  const reached = [];
  for (const e of capturePoked()) {
    if (e.mem8[(e.regs.ix + COUNTDOWN) & 0xffff] === 0) {
      zero.push(e);
      const p = e.clone();
      loc_58b6(p);
      animateFixedShapeCycleAtHalfRate(p);
      if (hasReachedRetireLine(p)) reached.push(e);
    } else {
      running.push(e);
    }
  }
  return { zero, running, reached };
}

/**
 * Every real dispatch ends its sweep with nothing left to do, so a handler that never goes round —
 * or goes round the wrong number of times — is invisible on them in memory. These go round: each
 * real entry with three turns left and the three slots after it planted with drifting objects, so
 * the step of each shows whether the sweep reached it, and a sweep one turn long reaches one it
 * should not.
 */
let looping = null;
function loopingEntries() {
  if (looping) return looping;
  looping = capturePoked().map((e) => {
    const m = e.clone();
    m.regs.b = 3;
    for (const next of [0x10, 0x20, 0x30]) m.mem8[(m.regs.ix + next) & 0xffff] = 0x30;
    return m;
  });
  return looping;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/**
 * The rewrite with one defect each; every knob matches stepSlotApproachThenBreakawayRetire by default.
 * Written in the rewrite's own form — the record, the entry and the count taken once on entry and
 * handed to each callee — so each twin differs from the rewrite in its one defect only.
 */
function twin({ fly = true, retire = true, alwaysRetire = false, advance = true, holdCount = true, dec = true, invert = false } = {}) {
  return (m) => {
    const { mem8 } = m;
    const { ix, iy } = m.regs;
    let turns = m.regs.b;
    const c = (ix + COUNTDOWN) & 0xffff;
    const zeroBranch = invert ? mem8[c] !== 0 : mem8[c] === 0;
    if (zeroBranch) {
      if (fly) flyAlongHeadingAtDoubleVelocity(m, OPENING_ERA_VELOCITY_TABLE, ix, iy);
      animateFixedShapeCycleAtHalfRate(m, iy);
      const reached = hasReachedRetireLine(m, iy);
      // the count lost: taken back from whatever the object work left in B
      if (!holdCount) turns = m.regs.b;
      if (alwaysRetire || (retire && reached)) retireSlot(m, ix, iy);
      return advance ? closeOneTurnOfTheSlotSweep(m, ix, iy, turns) : undefined;
    }
    if (dec) mem8[c] = (mem8[c] - 1) & 0xff;
    flyTowardShipStandoffThenEndApproach(m, ix, iy);
    return advance ? closeOneTurnOfTheSlotSweep(m, ix, iy, turns) : undefined;
  };
}

// [label, twin, exact catch count, the corpus it is counted on (the real dispatches by default)]
const TWINS = [
  ["no-op", () => {}, 445],
  ["skip-fly", twin({ fly: false }), 285],
  ["skip-retire", twin({ retire: false }), 1],
  ["always-retire", twin({ alwaysRetire: true }), 284],
  ["invert-branch", twin({ invert: true }), 445],
  ["forget-count", twin({ holdCount: false }), 285],
  ["skip-advance", twin({ advance: false }), 445, loopingEntries],
  ["no-dec", twin({ dec: false }), 160],
];

function caughtCount(tw, corpus) {
  let n = 0;
  for (const e of corpus) {
    const r = compare(tw, e);
    if (r.escaped !== null) n++;
  }
  return n;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: neither tape dispatches this address, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["attract", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [DISPATCH_SITE]: 0, [SWEEP_ENTRY]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [DISPATCH_SITE, (mm) => { seen[DISPATCH_SITE]++; return dispatchSite(mm); }],
      [SWEEP_ENTRY, (mm) => { seen[SWEEP_ENTRY]++; return sweepEntry(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // The zero counts only because the same tap saw the sweep ENTERED in the same run; it then
    // bails on its count/era guard before its loop ever dispatches a body.
    assert.ok(seen[SWEEP_ENTRY] > 0, `${label} counted nothing at the sweep entry, so the zero means nothing`);
    assert.equal(seen[TARGET], 0, `${label} now dispatches this address; capture plain entries instead of poking`);
    assert.equal(seen[DISPATCH_SITE], 0, `${label} now runs the sweep loop; the era gate is open and this account is stale`);
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} ${seen[TARGET]}, loop ${hex4(DISPATCH_SITE)} ${seen[DISPATCH_SITE]}, control ${hex4(SWEEP_ENTRY)} ${seen[SWEEP_ENTRY]}`);
  }
});

test("POKED DISPATCH: the era held at five, and every real dispatch replays identically", { skip }, () => {
  const entries = capturePoked();
  assert.ok(entries.length > 0, "vacuous: holding the era no longer makes the ROM reach this address");
  let low = 0x10000;
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped)}`);
    assert.equal(r.retOracle, r.retCand, "the return value diverged");
    assert.equal(r.spDiff, 2, "the dropped-ret SP drift moved off +2");
    if (r.low < low) low = r.low;
  }
  // ★ The mask is safe only if its floor never covers a data cell.
  assert.ok(low > DATA_TOP, `the stack window ${hex4(low)} reached into game data`);
  assert.ok(entries.some((e) => footprint(e).length > 0), "every dispatch writes nothing, so a do-nothing rewrite would pass");
  console.log(`  POKED DISPATCH: ${entries.length} real dispatches identical, SP +2, floor ${hex4(low)}`);
});

test("PATHS: both branches are equivalent and really move different cells", { skip }, () => {
  const { zero, running, reached } = classify();
  assert.ok(zero.length > 0 && running.length > 0, "a branch never occurred in the corpus");
  assert.ok(reached.length > 0, "no dispatch reached a retire line, so the retire call went untested");
  for (const e of [...zero, ...running]) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, "a path escaped the mask");
  }
  // ★ Vacuity guard: the paths must move DIFFERENT cells, or the split is decoration.
  const zeroPrint = footprint(zero.find((e) => !reached.includes(e))).join(",");
  assert.notEqual(zeroPrint, footprint(running[0]).join(","), "the zero and running paths move the same cells");
  assert.notEqual(zeroPrint, footprint(reached[0]).join(","), "retiring moves the same cells as not retiring");
  console.log(`  PATHS: zero ${zero.length}, running ${running.length}, reached ${reached.length}`);
});

test("DEAD AT EXIT: no register the oracle leaves is heard, and the instrument hears one that is read", { skip }, () => {
  assertDeadAtExit({
    at: TARGET, poison: LEFT_BEHIND, frames: SESSION_FRAMES, reachEvery: true,
    sessions: [{ label: "held era", pokes: SESSION }],
    // A poisoned record cursor on entry is heard in game data: the instrument is not deaf.
    controls: [{ label: "entry IX", poison: ["ix"], before: true, expect: "heard", every: true, dataOnly: true }],
  });
});

test("LOOPING: with turns left and an occupied next slot, the whole sweep replays identically", { skip }, () => {
  const entries = loopingEntries();
  assert.ok(entries.length > 0, "no entries to loop");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped)}`);
    assert.equal(r.spDiff, 2, "the remaining turns run as direct calls, so the oracle pops the sweep's return and the rewrite does not");
  }
  console.log(`  LOOPING: ${entries.length} entries identical`);
});

for (const [label, tw, expected, corpus = capturePoked] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip }, () => {
    const caught = caughtCount(tw, corpus());
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${corpus().length}`);
  });
}
