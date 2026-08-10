// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchPlayerFrameByState — memory-equivalent to the frozen oracle at ROM 0x1edf. GATE: crafted-entry over real
 * captures; coin-start reaches the centred-scroll arm and the undriven demo reaches the no-play arm,
 * and pokes force the other three. Live-out is memory, so the diff is the whole dump outside the
 * masked stack scratch; the +2 ret re-seat is asserted and the dead register file is left alone.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1edf.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { dispatchPlayerFrameByState as candidate } from "../dispatchPlayerFrameByState.js";
import { loc_1edf as oracle } from "../../translated/loc_1edf.js";
import { advancePlayerAnimationStrip } from "../advancePlayerAnimationStrip.js";
import { flyDemoShipByScript } from "../flyDemoShipByScript.js";
import { readPlayerControls } from "../readPlayerControls.js";
import { turnShipTowardTargetHeading } from "../turnShipTowardTargetHeading.js";
import { scrollWorldAtTheEraPace } from "../scrollWorldAtTheEraPace.js";

const TARGET = 0x1edf;
const CAP = 60;

const PLAYER_STATE = 0xa800;
const PLAY_ACTIVE = 0xad30;
const SCREEN_UNFLIPPED = 0xa987;
const MAIN_PANEL = 0xa9af;
const STATE_HI = 0xabfe;
const STATE_LO = 0xabff;
const RUNNING = 0xa5;
const DRAW_LO = 0x05;
const SEAT = 0xaa10;
const FIRST_FRAME = 0xc0; // any phase at or above the cap enters the animation's opening frame
// Every game cell sits at or below here; the stack seats far above it (measured floor 0xafe2), so
// masking the scratch can never hide a real byte.
const DATA_TOP = 0xadff;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── real dispatches ───────────────────────────────────────────────────────────────────────────
function captured(tape) {
  const entries = [];
  let collecting = true;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting && entries.length < CAP) entries.push(mm.clone());
    return oracle(mm);
  }]]), tape === undefined ? {} : { tape });
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  return entries;
}

let coinStart = null;
let undriven = null;
const coinStartRuns = () => (coinStart ??= captured(undefined));
const undrivenRuns = () => (undriven ??= captured([]));

// ── the masked comparison ─────────────────────────────────────────────────────────────────────
// The frozen side's terminal ret pops a return the rewrite never models and its calls push below the
// seat; [low, seat) is masked with low watched off the oracle's own pushes.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const rO = oracle(a);
  let rC, threw = null;
  try { rC = cand(b); } catch (e) { threw = String(e).slice(0, 60); }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (threw || da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, threw, low, seat, spDiff: a.regs.sp - b.regs.sp, rO, rC };
}
const diverges = (cand, m) => { const r = compare(cand, m); return !!(r.escaped || r.threw); };

function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── crafted scenarios: one per routed arm, poked onto a real captured state ──────────────────────
function craft(base, setups) {
  const c = base.clone();
  for (const [addr, val] of setups) c.mem8[addr] = val;
  return c;
}

let scenCache = null;
function scen() {
  if (scenCache) return scenCache;
  const base = coinStartRuns()[0];
  scenCache = {
    A: craft(base, [[PLAYER_STATE, 0]]),
    B: craft(base, [[PLAYER_STATE, 0x01]]),
    Bfirst: craft(base, [[PLAYER_STATE, FIRST_FRAME], [STATE_HI, RUNNING], [STATE_LO, DRAW_LO]]),
    C: undrivenRuns()[0],
    D: craft(base, [[PLAYER_STATE, 0xff], [PLAY_ACTIVE, 0x01], [SCREEN_UNFLIPPED, 0x01], [MAIN_PANEL, 0x01]]),
    E: base,
  };
  return scenCache;
}

// ── broken twins: the dispatch re-derived, each with one defect, real callees kept ───────────────
function seatBoth(m) { m.regs.ix = PLAYER_STATE; m.regs.iy = SEAT; }
function noOp() {}
function dropGuard(m) {
  const { regs, mem8 } = m;
  seatBoth(m);
  if (mem8[PLAYER_STATE] !== 0xff) return advancePlayerAnimationStrip(m);
  if (mem8[PLAY_ACTIVE] === 0) return flyDemoShipByScript(m);
  regs.a = readPlayerControls(m) & 0x0f;
  return regs.a !== 0 ? turnShipTowardTargetHeading(m) : scrollWorldAtTheEraPace(m);
}
function alwaysAnimate(m) {
  seatBoth(m);
  if (m.mem8[PLAYER_STATE] === 0) return;
  return advancePlayerAnimationStrip(m);
}
function swapTurnScroll(m) {
  const { regs, mem8 } = m;
  seatBoth(m);
  const state = mem8[PLAYER_STATE];
  if (state === 0) return;
  if (state !== 0xff) return advancePlayerAnimationStrip(m);
  if (mem8[PLAY_ACTIVE] === 0) return flyDemoShipByScript(m);
  regs.a = readPlayerControls(m) & 0x0f;
  return regs.a !== 0 ? scrollWorldAtTheEraPace(m) : turnShipTowardTargetHeading(m);
}
function wrongSeat(m) {
  const { regs, mem8 } = m;
  regs.ix = PLAYER_STATE;
  regs.iy = SEAT + 2;
  const state = mem8[PLAYER_STATE];
  if (state === 0) return;
  if (state !== 0xff) return advancePlayerAnimationStrip(m);
  if (mem8[PLAY_ACTIVE] === 0) return flyDemoShipByScript(m);
  regs.a = readPlayerControls(m) & 0x0f;
  return regs.a !== 0 ? turnShipTowardTargetHeading(m) : scrollWorldAtTheEraPace(m);
}

const TWINS = [
  ["no-op", noOp, ["B", "Bfirst", "C", "D", "E"]],
  ["drop-clear-guard", dropGuard, ["A"]],
  ["always-animate", alwaysAnimate, ["C", "D", "E"]],
  ["swap-turn-scroll", swapTurnScroll, ["D", "E"]],
  ["wrong-paired-seat", wrongSeat, ["Bfirst"]],
];

// ── the gate ─────────────────────────────────────────────────────────────────────────────────
test("REAL: every captured dispatch replays identically, and some write", { skip }, () => {
  const all = [...coinStartRuns(), ...undrivenRuns()];
  assert.ok(coinStartRuns().length > 0 && undrivenRuns().length > 0,
    "vacuous: a tape no longer reaches this address");
  for (const e of all) {
    const r = compare(candidate, e);
    assert.equal(r.threw, null, r.threw && `the candidate threw: ${r.threw}`);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.rO, r.rC, "the return value diverged");
  }
  const wrote = all.filter((e) => footprint(e) > 0).length;
  assert.ok(wrote > 0, "no captured dispatch makes the oracle write, so this arm would pass a no-op");
  console.log(`  REAL: ${all.length} dispatches identical, ${wrote} of them write`);
});

test("BRANCHES: every routed arm replays, and the arms really differ", { skip }, () => {
  for (const [label, c] of Object.entries(scen())) {
    const r = compare(candidate, c);
    assert.equal(r.escaped, null, `${label}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.rO, r.rC, `${label}: the return value diverged`);
  }
  const foot = Object.fromEntries(Object.entries(scen()).map(([n, c]) => [n, footprint(c)]));
  // ★ Vacuity guard: the clear arm writes nothing, the animation's opening frame paints a strip,
  // and the three wound arms each move some game state, so no confusion of them survives all six.
  assert.equal(foot.A, 0, "the clear arm moved memory");
  assert.ok(foot.Bfirst > foot.C && foot.Bfirst > foot.D && foot.Bfirst > foot.E,
    "the opening animation frame no longer moves the most");
  assert.ok(foot.C > 0 && foot.D > 0 && foot.E > 0, "a wound arm moved nothing");
  console.log(`  BRANCHES: 6 identical; footprints ${Object.entries(foot).map(([n, v]) => `${n}=${v}`).join(" ")}`);
});

test("SP AND RETURN: the ret re-seat is +2 on every arm and the mask floor sits above the data",
  { skip }, () => {
    for (const [label, c] of Object.entries(scen())) {
      const r = compare(candidate, c);
      assert.equal(r.spDiff, 2, `${label}: the frozen side no longer re-seats two bytes higher`);
      assert.ok(r.low > DATA_TOP, `${label}: the stack window ${hex4(r.low)} reached into game data`);
    }
    console.log("  SP: +2 on every arm; the mask window sits over the stack, clear of the data");
  });

for (const [label, twin, targets] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly its arms`, { skip }, () => {
    const on = Object.entries(scen()).filter(([, c]) => diverges(twin, c)).map(([n]) => n);
    assert.ok(on.length > 0, `the ${label} twin is not caught at all`);
    assert.deepEqual(on.sort(), [...targets].sort(), `the ${label} twin's caught arms moved`);
    console.log(`  TEETH/${label}: caught on ${on.length}/6 — ${on.join(", ")}`);
  });
}
