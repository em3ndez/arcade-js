// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_294c — memory-equivalent to the frozen oracle at ROM 0x294C, run through the dispatch seam so SP
 * and pc are compared for equality. GATE: the undriven attract run is what reaches this arm (the era
 * index turns to 1 there; the coin-start tape holds era 0 and never dispatches it), so every real
 * dispatch of an attract replay is compared, plus capped buckets of every status class the run
 * presents -- empty, active, retiring (active and reaching the line), held, dying -- all REAL entries.
 * Registers: ix and iy are held on every entry; on the active (refreshed) path the accumulator and
 * flags the sprite refresh leaves are compared too. Teeth: broken twins, each caught exactly where its
 * bug shows. Run: node --test games/timeplt/idiomatic/test/equivalence-294c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { withOmittedRet } from "../../machine.js";
import { buildRoutines } from "../../routines.js";
import { loc_294c } from "../loc_294c.js";
import { loc_294c as oracle } from "../../translated/loc_294c.js";
import { steerTowardAimHeading } from "../steerTowardAimHeading.js";
import { loc_5854 } from "../loc_5854.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { retireSlotAndSubPixel } from "../retireSlotAndSubPixel.js";
import { launchBankEnemyWhenAimedNearPlayer } from "../launchBankEnemyWhenAimedNearPlayer.js";
import { refreshSecondEraSpriteFromHeading } from "../refreshSecondEraSpriteFromHeading.js";
import { refreshSpriteFromHeading } from "../refreshSpriteFromHeading.js";
import { releaseHeldObject } from "../releaseHeldObject.js";
import { stepDyingObjectState } from "../stepDyingObjectState.js";

const TARGET = 0x294c;
/** The retire arm the oracle transfers to; hooked only to classify a captured entry as retiring. */
const RETIRE_ARM = 0x2bde;
const EMPTY = 0;
const HELD = 0xfe;
const ACTIVE = 0xff;
const DATA_TOP = 0xadff;
const CAP = 60;
/** Measured: the attract run first dispatches this arm near frame 1123 and presents every class by 4000. */
const CAPTURE_FRAMES = 4000;
const REPLAY_FRAMES = 1800;
const CLASSES = ["empty", "active", "retiring", "held", "dying"];
const ATTRACT = { tape: [] };
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.key ?? hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const seam = (candidate) => withOmittedRet(candidate, TARGET);

const statusClass = (m) => {
  const s = m.mem8[m.regs.ix];
  return s === EMPTY ? "empty" : s === ACTIVE ? "active" : s === HELD ? "held" : "dying";
};

/** Oracle vs seam-wrapped candidate on two clones: masked RAM (dead stack scratch below the seat,
 *  watched off both sides' pushes), then SP, pc, the slot pointers, and -- when `withAF` -- the
 *  accumulator and flags. */
function unitDiff(candidate, machine, withAF = false) {
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
  const regs = withAF ? ["ix", "iy", "a", "f"] : ["ix", "iy"];
  for (const k of regs) if (a.regs[k] !== b.regs[k]) return { key: k, a: hex4(a.regs[k]), b: hex4(b.regs[k]) };
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
/** One attract run; each entry is cloned BEFORE the oracle runs, then filed by the path it took. */
function captureBuckets() {
  if (captured) return captured;
  const buckets = Object.fromEntries(CLASSES.map((k) => [k, []]));
  const retireArm = buildRoutines().get(RETIRE_ARM);
  let inside = false;
  let retired = false;
  let dispatches = 0;
  const m = makeMachine(new Map([
    [TARGET, (mm) => {
      dispatches++;
      const entry = mm.clone();
      inside = true; retired = false;
      const r = oracle(mm);
      inside = false;
      let k = statusClass(entry);
      if (k === "active" && retired) k = "retiring";
      if (buckets[k].length < CAP) buckets[k].push(entry);
      return r;
    }],
    [RETIRE_ARM, (mm) => { if (inside) retired = true; return retireArm(mm); }],
  ]), ATTRACT);
  const frames = m.runFrames(CAPTURE_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CAPTURE_FRAMES, "the capture run ran short");
  captured = { buckets, dispatches };
  return captured;
}

function replaySession(opts, frameCount, candidate) {
  let dispatches = 0;
  let caught = 0;
  let first = null;
  const classes = new Set();
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    classes.add(statusClass(mm));
    const d = unitDiff(candidate, mm);
    if (d) { caught++; if (!first) first = d; }
    return oracle(mm);
  }]]), opts);
  const frames = m.runFrames(frameCount);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, frameCount, "session ran short");
  return { dispatches, caught, first, classes };
}

const caughtOn = (candidate, entries, withAF) => entries.filter((e) => unitDiff(candidate, e, withAF)).length;

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** The correct active arm with one step swapped out, shared by the twins that bend only that arm. */
function activeArm(m, { steer = true, retire = "test", refresh = refreshSecondEraSpriteFromHeading } = {}) {
  if (steer) steerTowardAimHeading(m);
  loc_5854(m);
  const reached = hasReachedRetireLine(m);
  if (retire === "always" || (retire === "test" && reached)) return retireSlotAndSubPixel(m);
  launchBankEnemyWhenAimedNearPlayer(m);
  return refresh(m);
}
function dispatchWith(active) {
  return (m) => {
    const s = m.mem8[m.regs.ix];
    if (s === EMPTY) return;
    if (s === HELD) return releaseHeldObject(m);
    if (s !== ACTIVE) return stepDyingObjectState(m);
    return active(m);
  };
}

/** BUG: does nothing. */
function brokenNoOp() {}
/** BUG: never retires, so a craft on the line is launched from and refreshed instead of cleared. */
const brokenNeverRetires = dispatchWith((m) => activeArm(m, { retire: "never" }));
/** BUG: retires every active craft. */
const brokenAlwaysRetires = dispatchWith((m) => activeArm(m, { retire: "always" }));
/** BUG: dresses the sprite from the first era's bank, the refresh this arm exists to differ by. */
const brokenFirstEraRefresh = dispatchWith((m) => activeArm(m, { refresh: refreshSpriteFromHeading }));
/** BUG: treats a held object as dying. */
function brokenHeldAsDying(m) {
  const s = m.mem8[m.regs.ix];
  if (s === EMPTY) return;
  if (s !== ACTIVE) return stepDyingObjectState(m);
  return activeArm(m);
}
/** BUG: scribbles the slot pointer on the way out -- memory-invisible, the register arm must see it. */
function brokenMovesIx(m) { const r = loc_294c(m); m.regs.ix = (m.regs.ix + 1) & 0xffff; return r; }
/** BUG: leaves the wrong accumulator on the refreshed path -- only the A/F arm can see it. */
function brokenLeavesA(m) {
  const r = loc_294c(m);
  if (m.mem8[m.regs.ix] === ACTIVE) m.regs.a = (m.regs.a ^ 0x01) & 0xff;
  return r;
}

/** Per class: "all" the twin must be caught on every entry, "none" it must match on every one. */
const TWINS = [
  ["no-op", brokenNoOp, { empty: "none", active: "all", retiring: "all", held: "all", dying: "all" }],
  ["never-retires", brokenNeverRetires, { empty: "none", active: "none", retiring: "all", held: "none", dying: "none" }],
  ["always-retires", brokenAlwaysRetires, { empty: "none", active: "all", retiring: "none", held: "none", dying: "none" }],
  ["first-era-refresh", brokenFirstEraRefresh, { empty: "none", active: "all", retiring: "none", held: "none", dying: "none" }],
  ["held-as-dying", brokenHeldAsDying, { empty: "none", active: "none", retiring: "none", held: "all", dying: "none" }],
  ["moves-ix", brokenMovesIx, { empty: "all", active: "all", retiring: "all", held: "all", dying: "all" }],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACHED: attract dispatches this arm; the coin-start tape (held in era 0) does not", { skip }, () => {
  const attract = replaySession(ATTRACT, REPLAY_FRAMES, loc_294c);
  const driven = replaySession({}, ENTRY_FRAMES, loc_294c);
  assert.ok(attract.dispatches > 0, "vacuous: the attract replay never reached the routine");
  assert.equal(attract.caught, 0, `the rewrite diverged on ${attract.caught} real dispatches: ${show(attract.first)}`);
  assert.equal(driven.dispatches, 0,
    "the coin-start tape now reaches this arm, so attract is no longer the only source of the corpus");
  console.log(`  REACHED: attract ${attract.dispatches} over {${[...attract.classes].sort().join(",")}}, ` +
    `all identical; coin-start ${driven.dispatches}`);
});

test("EQUAL at every captured entry of every class; a no-op FAILS the same comparison", { skip }, () => {
  const { buckets, dispatches } = captureBuckets();
  for (const k of CLASSES) {
    assert.ok(buckets[k].length > 0, `vacuous: no ${k} entry captured`);
    for (const entry of buckets[k]) {
      const d = unitDiff(loc_294c, entry, k === "active");
      assert.equal(d, null, `a ${k} entry diverged: ${show(d)}`);
    }
  }
  assert.notEqual(unitDiff(brokenNoOp, buckets.active[0]), null,
    "the masked comparison passed a do-nothing candidate on an active entry, so it measures nothing");
  console.log(`  EQUAL: ${dispatches} dispatches; ` +
    `${CLASSES.map((k) => `${k}=${buckets[k].length}`).join(" ")} all identical (RAM, SP, pc, ix, iy; A/F on active)`);
});

test("SP AND SCRATCH: the oracle nets one return and the window stays above game data", { skip }, () => {
  const { buckets } = captureBuckets();
  for (const k of CLASSES) {
    for (const entry of buckets[k]) {
      const r = maskProbe(entry);
      assert.equal(r.reseat, 2, `${k}: the oracle did not net exactly one return (${r.reseat})`);
      assert.ok(r.low > DATA_TOP, `${k}: the stack window ${hex4(r.low)} reached down into game data`);
    }
  }
  const r = maskProbe(buckets.active[0]);
  console.log(`  SP AND SCRATCH: every exit re-seats +2; window floor ${hex4(r.low)} over ${hex4(DATA_TOP)}`);
});

test("REGISTERS: the A/F arm is live -- a twin leaving the wrong accumulator is caught only by it", { skip }, () => {
  const { buckets } = captureBuckets();
  const withArm = caughtOn(brokenLeavesA, buckets.active, true);
  const withoutArm = caughtOn(brokenLeavesA, buckets.active, false);
  assert.equal(withArm, buckets.active.length, "the A/F arm let a wrong accumulator through");
  assert.equal(withoutArm, 0, "memory alone caught the accumulator twin, so the arm is not what sees it");
  console.log(`  REGISTERS: leaves-A caught ${withArm}/${buckets.active.length} with the arm, ${withoutArm} without`);
});

for (const [label, twin, expect] of TWINS) {
  test(`TEETH: the ${label} twin is caught exactly where its bug shows`, { skip }, () => {
    const { buckets } = captureBuckets();
    const report = {};
    for (const k of CLASSES) {
      const caught = caughtOn(twin, buckets[k], k === "active");
      report[k] = `${caught}/${buckets[k].length}`;
      if (expect[k] === "all") assert.equal(caught, buckets[k].length, `the ${label} twin escaped some ${k} entries`);
      else assert.equal(caught, 0, `the ${label} twin was caught on a ${k} entry it should have matched`);
    }
    assert.ok(Object.values(expect).includes("all"), `the ${label} twin catches nothing`);
    console.log(`  TEETH/${label}: ${CLASSES.map((k) => `${k}=${report[k]}`).join(" ")}`);
  });
}
