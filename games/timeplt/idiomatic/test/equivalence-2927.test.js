// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2927 — memory-equivalent to the frozen oracle at ROM 0x2927, run through the dispatch seam so
 * SP and pc are compared for equality. GATE: every real dispatch of the coin-start tape across the
 * empty/active/dying status classes, a crafted held (0xFE) entry the tape never presents, a masked
 * stack window proven above game data, and teeth. Run: node --test .../equivalence-2927.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { withOmittedRet } from "../../machine.js";
import { loc_2927 } from "../loc_2927.js";
import { loc_2927 as oracle } from "../../translated/loc_2927.js";
import { releaseHeldObject } from "../releaseHeldObject.js";
import { stepDyingObjectState } from "../stepDyingObjectState.js";

const TARGET = 0x2927;
const EMPTY = 0;
const HELD = 0xfe;
const ACTIVE = 0xff;
const DATA_TOP = 0xadff;
const CAP = 80;
const CLASSES = ["empty", "active", "dying", "held"];
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SESSIONS = [["coin-start", {}], ["attract", { tape: [] }]];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.key ?? hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const seam = (candidate) => withOmittedRet(candidate, TARGET);

const statusClass = (m) => {
  const s = m.mem8[m.regs.ix];
  return s === EMPTY ? "empty" : s === ACTIVE ? "active" : s === HELD ? "held" : "dying";
};

/** Oracle vs seam-wrapped candidate on two clones: masked RAM (dead stack scratch below the seat,
 *  watched off both sides' pushes), then SP and pc, which the seam makes comparable for equality. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const pa = a.push16.bind(a); a.push16 = (v) => { pa(v); if (a.regs.sp < low) low = a.regs.sp; };
  const pb = b.push16.bind(b); b.push16 = (v) => { pb(v); if (b.regs.sp < low) low = b.regs.sp; };
  oracle(a);
  seam(candidate)(b);
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  if (a.regs.sp !== b.regs.sp) return { key: "sp", a: hex4(a.regs.sp), b: hex4(b.regs.sp) };
  if (a.pc !== b.pc) return { key: "pc", a: hex4(a.pc), b: hex4(b.pc) };
  return null;
}

/** The window floor and the SP re-seat, watched off the frozen side's own pushes. */
function maskProbe(machine) {
  const a = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const pa = a.push16.bind(a); a.push16 = (v) => { pa(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  return { low, seat, reseat: (a.regs.sp - seat) & 0xffff };
}

// ── captures ──────────────────────────────────────────────────────────────────────────────

let captured = null;
function captureBuckets() {
  if (captured) return captured;
  const buckets = { empty: [], active: [], dying: [] };
  const m = makeMachine(new Map([[TARGET, (mm) => {
    const k = statusClass(mm);
    if (buckets[k] && buckets[k].length < CAP) buckets[k].push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  captured = buckets;
  return captured;
}

/** The tape never presents 0xFE, so poke it onto real active entries — a real state, one nudge. */
function heldEntries() {
  return captureBuckets().active.map((e) => {
    const c = e.clone();
    c.mem8[c.regs.ix] = HELD;
    return c;
  });
}

function allEntries() {
  const b = captureBuckets();
  return { empty: b.empty, active: b.active, dying: b.dying, held: heldEntries() };
}

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const classes = new Set();
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    classes.add(statusClass(mm));
    if (unitDiff(candidate, mm)) caught++;
    return oracle(mm);
  }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "session ran short");
  return { dispatches, caught, classes };
}

const caughtOn = (candidate, entries) => entries.filter((e) => unitDiff(candidate, e)).length;

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing, so an object that should have moved, retired, released or stepped does not. */
function brokenNoOp() {}

/** BUG: releases on every non-empty status, so an active or dying object is wrongly released. */
function brokenAlwaysReleases(m) {
  if (m.mem8[m.regs.ix] === EMPTY) return;
  return releaseHeldObject(m);
}

/** BUG: steps-dying on every non-empty status, so an active or held object is wrongly stepped. */
function brokenAlwaysStepsDying(m) {
  if (m.mem8[m.regs.ix] === EMPTY) return;
  return stepDyingObjectState(m);
}

/** Per class: "all" the twin must be caught on every entry, "none" it must match. Structural, so
 *  not session-count dependent — a status the twin dispatches wrongly parts company in memory. */
const TWINS = [
  ["no-op", brokenNoOp, { empty: "none", active: "all", dying: "all", held: "all" }],
  ["always-releases", brokenAlwaysReleases, { empty: "none", active: "all", dying: "all", held: "none" }],
  ["always-steps-dying", brokenAlwaysStepsDying, { empty: "none", active: "all", dying: "none", held: "all" }],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHED: the coin-start tape dispatches every status class; attract reaches none", { skip }, () => {
  const [driven, attract] = SESSIONS.map(([label, opts]) => ({ label, ...replaySession(opts, loc_2927) }));
  assert.ok(driven.dispatches > 0, "vacuous: the coin-start tape never reached the routine");
  assert.equal(driven.caught, 0, `the rewrite diverged on ${driven.caught} driven dispatches`);
  assert.equal(attract.dispatches, 0,
    "the attract session now reaches the routine, so the tape is no longer what buys the corpus");
  const b = captureBuckets();
  for (const k of ["empty", "active", "dying"]) assert.ok(b[k].length > 0, `vacuous: no ${k} entry captured`);
  console.log(`  REACHED: driven ${driven.dispatches} over {${[...driven.classes].sort().join(",")}}, ` +
    `attract ${attract.dispatches}`);
});

test("EQUAL at every captured and crafted entry; a no-op FAILS the same comparison", { skip }, () => {
  const e = allEntries();
  for (const k of CLASSES) {
    for (const entry of e[k]) {
      const d = unitDiff(loc_2927, entry);
      assert.equal(d, null, `a ${k} entry diverged: ${show(d)}`);
    }
  }
  assert.notEqual(unitDiff(brokenNoOp, e.active[0]), null,
    "the masked comparison passed a do-nothing candidate on an active entry, so it measures nothing");
  console.log(`  EQUAL: ${e.empty.length}+${e.active.length}+${e.dying.length} real + ${e.held.length} ` +
    "crafted held, all identical (RAM, SP, pc)");
});

test("SP AND SCRATCH: the oracle nets one return and the window stays above game data", { skip }, () => {
  const e = allEntries();
  for (const k of CLASSES) {
    for (const entry of e[k]) {
      const r = maskProbe(entry);
      assert.equal(r.reseat, 2, `${k}: the oracle did not net exactly one return (${r.reseat})`);
      assert.ok(r.low > DATA_TOP, `${k}: the stack window ${hex4(r.low)} reached down into game data`);
    }
  }
  const r = maskProbe(e.active[0]);
  console.log(`  SP AND SCRATCH: every exit re-seats +2; window floor ${hex4(r.low)} over ${hex4(DATA_TOP)}`);
});

for (const [label, twin, expect] of TWINS) {
  test(`TEETH: the ${label} twin is caught exactly where its bug shows`, { skip }, () => {
    const e = allEntries();
    const report = {};
    for (const k of CLASSES) {
      const caught = caughtOn(twin, e[k]);
      report[k] = `${caught}/${e[k].length}`;
      if (expect[k] === "all") assert.equal(caught, e[k].length, `the ${label} twin escaped some ${k} entries`);
      else assert.equal(caught, 0, `the ${label} twin was caught on a ${k} entry it should have matched`);
    }
    assert.ok(Object.values(expect).includes("all"), `the ${label} twin catches nothing`);
    console.log(`  TEETH/${label}: ${CLASSES.map((k) => `${k}=${report[k]}`).join(" ")}`);
  });
}
