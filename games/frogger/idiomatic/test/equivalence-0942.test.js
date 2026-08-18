// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-0942 — crafted-entry gate: renderFrogSceneAndTickTimer vs the frozen oracle at ROM 0x0942
 * (the loc_0425 render core). Covers the PLAY_FLAG=0 branches (bare ret when the demo gate is set, else
 * the frog reset), the player-1 timer tick and its expiry into 0x83CF, the player-2 / demo-gate-set path
 * that skips the timer + home marker, and the lane-param + frog-animation-dispatch path (0x825A != 0).
 * The dispatcher is now dissolved to a direct idiomatic call (dispatchFrogAnimationArm), so the anim path
 * runs the real dispatcher on both sides -- the candidate direct, the oracle via its m.call(0x0FAF) -- the
 * two proven equivalent by equivalence-0faf; the stack scratch it churns is masked. Teeth: no-op, a skipped flag,
 * a skipped timer decrement, a wrong return-A (all must diff); positive control the timer expiry + reset fire.
 * Live-out: memory + A (caller 0x040B stores A into continue flag 0x83EA); stack masked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { renderFrogSceneAndTickTimer as cand } from "../renderFrogSceneAndTickTimer.js";
import { loc_0942 as oracle } from "../../translated/loc_0942.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const PLAY = 0x83fe, PLAYER = 0x83fd, DEMO = 0x83cd, EXPIRY = 0x83cf, T1 = 0x83e5;
const DEMOFLAG = 0x825a, CNT_EN = 0x826c, MIRROR = 0x83b5, READY = 0x83c3;

// A is a live-out: the board-setup caller stores the returned A into the continue flag. Compare it too.
function aDiff(entry, candFn = cand) {
  const a = entry.clone(); oracle(a);
  const b = entry.clone(); candFn(b);
  return a.regs.a === b.regs.a ? null : `A: ${a.regs.a} vs ${b.regs.a}`;
}

const playOffReset = () => craft((mem) => { mem[PLAY] = 0; mem[DEMO] = 1; });
const playOffRet = () => craft((mem) => { mem[PLAY] = 0; mem[DEMO] = 0; });
const p1Tick = () => craft((mem) => { mem[PLAY] = 1; mem[PLAYER] = 1; mem[DEMO] = 0; mem[T1] = 5; mem[DEMOFLAG] = 0; mem[CNT_EN] = 0; });
const p1Expiry = () => craft((mem) => { mem[PLAY] = 1; mem[PLAYER] = 1; mem[DEMO] = 0; mem[T1] = 1; mem[EXPIRY] = 0; mem[DEMOFLAG] = 0; mem[CNT_EN] = 1; });
const p2Gated = () => craft((mem) => { mem[PLAY] = 1; mem[PLAYER] = 2; mem[DEMO] = 1; mem[DEMOFLAG] = 0; mem[CNT_EN] = 0; });
const animPath = () => craft((mem) => { mem[PLAY] = 1; mem[PLAYER] = 1; mem[DEMO] = 0; mem[DEMOFLAG] = 1; mem[CNT_EN] = 0; mem[0x8000] = 0; });

test("EQUAL (crafted): renderFrogSceneAndTickTimer == oracle across branches", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, playOffReset()), null, "PLAY=0 / demo-set reset diverged");
  assert.equal(ramDiff(oracle, cand, playOffRet()), null, "PLAY=0 / demo-clear ret diverged");
  assert.equal(ramDiff(oracle, cand, p1Tick()), null, "P1 timer tick diverged");
  assert.equal(ramDiff(oracle, cand, p1Expiry()), null, "P1 timer expiry diverged");
  assert.equal(ramDiff(oracle, cand, p2Gated()), null, "P2 / demo-gated diverged");
  assert.equal(ramDiff(oracle, cand, animPath()), null, "lane-param + anim-dispatch path diverged");

  assert.equal(aDiff(playOffRet()), null, "A live-out diverged on the demo-clear bare return");
  assert.equal(aDiff(playOffReset()), null, "A live-out diverged on the demo-set reset");
  assert.equal(aDiff(p1Tick()), null, "A live-out diverged on the P1 tick path");

  const e = p1Expiry(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[T1], 0, "vacuous: timer never reached 0");
  assert.equal(a.mem8[EXPIRY], 1, "vacuous: expiry flag never set");
  assert.equal(a.mem8[READY], 1, "vacuous: frog reset never ran");
  console.log(`  EQUAL: timer ${e.mem8[T1]}->${a.mem8[T1]}, expiry ->${a.mem8[EXPIRY]}, ready ->${a.mem8[READY]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipMirror = (m) => { cand(m); m.mem8[MIRROR] = (m.mem8[MIRROR] + 1) & 0xff; };
  const skipTimerDec = (m) => { const t = m.mem8[T1]; cand(m); m.mem8[T1] = t; };
  assert.ok(ramDiff(oracle, noOp, p1Tick()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipMirror, p1Tick()), "wrong-mirror twin escaped");
  assert.ok(ramDiff(oracle, skipTimerDec, p1Tick()), "skip-timer-dec twin escaped");
  const wrongA = (m) => { cand(m); m.regs.a = (m.regs.a + 1) & 0xff; };
  assert.ok(aDiff(playOffRet(), wrongA), "wrong-return-A twin escaped");
  console.log("  TEETH: no-op, wrong-mirror, skip-timer-dec, wrong-A all caught");
});
