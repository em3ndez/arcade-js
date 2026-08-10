// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1199 vs the frozen oracle at ROM 0x1199 — the per-frame service list then a player-state tail.
 * GATE: masked strict. Real captures run the tape; crafted 0xA800 forces each tail arm. The dissolved
 * calls drop the callees' pushed return words, so the oracle's [low, seat) stack scratch is masked and
 * the two-byte drift asserted; the mask floor is proven to sit above data.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1199.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_1199 as candidate } from "../loc_1199.js";
import { loc_1199 as oracle } from "../../translated/loc_1199.js";

import { reaimAndAnimateEnemyCraftOnPhaseTick } from "../reaimAndAnimateEnemyCraftOnPhaseTick.js";
import { dispatchPlayerFrameByState } from "../dispatchPlayerFrameByState.js";
import { fireAndSweepPlayerShots } from "../fireAndSweepPlayerShots.js";
import { driveEnemyWaveForLifePhase } from "../driveEnemyWaveForLifePhase.js";
import { multiplexSpriteSlotsSkipping } from "../multiplexSpriteSlotsSkipping.js";
import { runParachutistSlot } from "../runParachutistSlot.js";
import { stepSevenCraftSlots } from "../stepSevenCraftSlots.js";
import { runSceneryForEra } from "../runSceneryForEra.js";
import { sweepEra2PlusObjectBank } from "../sweepEra2PlusObjectBank.js";
import { serviceEra1BomberObject } from "../serviceEra1BomberObject.js";
import { loc_3dda } from "../loc_3dda.js";
import { stepFourActorSlots } from "../stepFourActorSlots.js";
import { serviceEra0BallisticObjectBank } from "../serviceEra0BallisticObjectBank.js";
import { dispatchCollisionPassByEra } from "../dispatchCollisionPassByEra.js";
import { askForSoundWhileTheGroupIsClear } from "../askForSoundWhileTheGroupIsClear.js";
import { loc_4dde } from "../loc_4dde.js";
import { expireHitChain } from "../expireHitChain.js";
import { escalateDifficultyRungOnCounterWrap } from "../escalateDifficultyRungOnCounterWrap.js";
import { drawKillMeter } from "../drawKillMeter.js";
import { multiplexSpriteSlots } from "../multiplexSpriteSlots.js";
import { advanceRoundWhenFieldCleared } from "../advanceRoundWhenFieldCleared.js";
import { loseLifeAndHandOver } from "../loseLifeAndHandOver.js";

const TARGET = 0x1199;
const PLAYER_STATE = 0xa800;
const DEAD = 0xff;
const ALIVE = 0x05;
const DATA_TOP = 0xadff;
const CAP = 60;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? "ret/reg" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical");

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  captured = entries;
  return captured;
}

/** A captured machine with the tail's player-state byte forced, identically before either side runs. */
function craft(state) {
  const m = capture()[0].clone();
  m.mem8[PLAYER_STATE] = state;
  return m;
}

/** Masked memory diff plus the return value: skip the window the oracle's own pushes reach. */
function unitDiff(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  let ra, rb;
  ra = oracle(a);
  try { rb = cand(b); } catch (e) { return { addr: null, a: "returned", b: String(e).slice(0, 40) }; }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  if (ra !== rb) return { addr: null, a: `ret ${ra}`, b: `ret ${rb}` };
  return null;
}

/** The oracle's stack floor and the drift the dropped return words leave. */
function spProbe(machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  candidate(b);
  return { low, seat, spDiff: a.regs.sp - b.regs.sp };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────────
// A reproduction of the service list, so a twin can drop one service or take the wrong tail arm.
function services(m, skipIdx = -1) {
  const fix = () => { m.push16(0); multiplexSpriteSlotsSkipping(m); };
  const list = [
    reaimAndAnimateEnemyCraftOnPhaseTick, dispatchPlayerFrameByState, fireAndSweepPlayerShots,
    driveEnemyWaveForLifePhase, fix, runParachutistSlot, (mm) => { mm.push16(0); mm.call(0x43b7); },
    stepSevenCraftSlots, fix, runSceneryForEra, sweepEra2PlusObjectBank, fix, serviceEra1BomberObject,
    loc_3dda, stepFourActorSlots, fix, serviceEra0BallisticObjectBank, dispatchCollisionPassByEra,
    askForSoundWhileTheGroupIsClear, fix, loc_4dde, expireHitChain, escalateDifficultyRungOnCounterWrap,
    drawKillMeter, multiplexSpriteSlots,
  ];
  for (let i = 0; i < list.length; i++) if (i !== skipIdx) list[i](m);
}
function tail(m) {
  const s = m.mem.read8(PLAYER_STATE);
  if (s === DEAD) return advanceRoundWhenFieldCleared(m);
  if (s !== 0) return;
  return loseLifeAndHandOver(m);
}

const brokenNoOp = () => {};
const brokenNoTail = (m) => services(m);
const brokenAlwaysAdvance = (m) => { services(m); advanceRoundWhenFieldCleared(m); };
const brokenAlwaysLoseLife = (m) => { services(m); loseLifeAndHandOver(m); };
const brokenDropCollision = (m) => { services(m, 17); tail(m); };
const brokenDropLastMux = (m) => { services(m, 24); tail(m); };

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-tail", brokenNoTail],
  ["always-advance", brokenAlwaysAdvance],
  ["always-lose-life", brokenAlwaysLoseLife],
  ["drop-collision", brokenDropCollision],
  ["drop-last-mux", brokenDropLastMux],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("REAL DISPATCHES: every captured entry under the tape is identical", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: the tape never dispatched this address");
  for (const e of entries) {
    const d = unitDiff(candidate, e);
    assert.equal(d, null, `a real dispatch diverged: ${show(d)}`);
  }
  console.log(`  REAL DISPATCHES: ${entries.length} captured, all identical`);
});

test("TAIL ARMS: each forced player-state is identical, and the writing arms write", { skip }, () => {
  for (const [label, state] of [["dead", DEAD], ["alive", ALIVE], ["cleared", 0x00]]) {
    const d = unitDiff(candidate, craft(state));
    assert.equal(d, null, `the ${label} arm diverged: ${show(d)}`);
  }
  const cleared = footprint(craft(0x00));
  const dead = footprint(craft(DEAD));
  assert.ok(cleared > dead, "the cleared arm hands a life over, so it must move more than the dead arm");
  console.log(`  TAIL ARMS: dead/alive/cleared identical; cleared moves ${cleared} bytes, dead ${dead}`);
});

test("SP DRIFT: the dropped return words are two bytes and the mask floor sits above data", { skip }, () => {
  for (const [label, m] of [["dead", craft(DEAD)], ["alive", craft(ALIVE)], ["cleared", craft(0x00)]]) {
    const r = spProbe(m);
    assert.equal(r.spDiff, 2, `the ${label} path no longer drops exactly two bytes (${r.spDiff})`);
    assert.ok(r.low > DATA_TOP, `${label} stack window reached into data (${hex4(r.low)})`);
  }
  console.log("  SP DRIFT: 2 bytes on every path, stack window above data");
});

test("TEETH: broken twins are caught, and the real routine passes the same entries", { skip }, () => {
  const pool = [...capture().slice(0, 8), craft(DEAD), craft(ALIVE), craft(0x00)];
  for (const [label, twin] of TWINS) {
    const caught = pool.filter((e) => unitDiff(twin, e)).length;
    assert.ok(caught > 0, `every entry PASSED the ${label} twin`);
  }
  for (const e of pool) assert.equal(unitDiff(candidate, e), null, "the real routine diverged on a pool entry");
  console.log(`  TEETH: ${TWINS.length} twins each caught; real routine clean on ${pool.length} entries`);
});
