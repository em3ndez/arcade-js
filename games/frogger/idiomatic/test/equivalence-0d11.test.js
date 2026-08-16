// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchGameModeFrame — memory-equivalent to the frozen oracle at ROM 0x0d11.
 * GATE: crafted-entry. Returns while the pacing timer 0x83d8 is nonzero; then dispatches on 0x83d6:
 * mode 3 -> renderMode3ScoreRankingScreen, credit/in-play gate 0x83e1!=0 -> initInPlayBoardOnce, mode 4
 * -> renderMode4PointTablePhase, mode 2 -> renderMode2IntroScreen, other -> return, mode 5 -> the reset
 * arm (reseed 0x83d8=0x30, clear 0x83d7/0x8015, blit a strip, tail into 0x0c17). Every branch cell is
 * poked so the body runs. Live-out memory-only; RAM compared, stack masked. Teeth: no-op, wrong reload,
 * skip-0x83d7-clear, wrong dispatch. Positive control: mode 5 seeds 0x83d8 0->0x30.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, SEAM_STUBS } from "./_spineDispatch.js";
import { dispatchGameModeFrame as cand } from "../dispatchGameModeFrame.js";
import { loc_0d11 as oracle } from "../../translated/loc_0d11.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const TIMER = 0x83d8, MODE = 0x83d6, INPLAY = 0x83e1, SUBPHASE = 0x83d7;

const timerRunning = () => craft((mem) => { mem[TIMER] = 5; });
const mode3 = () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 3; mem[INPLAY] = 0; });
const inPlay = () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 1; mem[INPLAY] = 1; });
const mode4 = () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 4; mem[INPLAY] = 0; });
const mode2 = () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 2; mem[INPLAY] = 0; });
const mode5 = () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 5; mem[INPLAY] = 0; });
const modeNone = () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 6; mem[INPLAY] = 0; });

test("EQUAL (crafted): dispatchGameModeFrame == oracle on every mode branch", { skip }, () => {
  for (const [name, mk] of [["timer", timerRunning], ["mode3", mode3], ["in-play", inPlay], ["mode4", mode4], ["mode2", mode2], ["mode5", mode5], ["none", modeNone]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = mode5(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[TIMER], 0x30, "positive control: mode-5 reseeds the pacing timer 0->0x30");
  console.log("  EQUAL: timer/mode3/in-play/mode4/mode2/mode5/none; control 0x83d8 0->0x30");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongReload = (m) => { cand(m); m.mem8[TIMER] = 0x31; };
  const skipSubphase = (m) => { cand(m); m.mem8[SUBPHASE] = 9; };
  assert.ok(ramDiff(oracle, noOp, mode5()), "no-op twin escaped (mode5)");
  assert.ok(ramDiff(oracle, wrongReload, mode5()), "wrong-reload twin escaped");
  assert.ok(ramDiff(oracle, skipSubphase, craft((mem) => { mem[TIMER] = 0; mem[MODE] = 5; mem[INPLAY] = 0; mem[SUBPHASE] = 9; })), "skip-subphase-clear twin escaped");
  assert.ok(ramDiff(oracle, noOp, mode3()), "wrong-dispatch (mode3 as no-op) escaped");
  console.log("  TEETH: no-op, wrong-reload, skip-subphase-clear, wrong-dispatch all caught");
});

test("SEAM: wireable — returns cleanly on delta-0 and +2 branches", { skip }, () => {
  const isIter = (r) => r && typeof r.next === "function" && typeof r.throw === "function";
  for (const [name, mk] of [
    ["timer", () => craft((mem) => { mem[TIMER] = 5; }, SEAM_STUBS)],
    ["mode3", () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 3; mem[INPLAY] = 0; }, SEAM_STUBS)],
    ["in-play", () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 1; mem[INPLAY] = 1; }, SEAM_STUBS)],
    ["mode5", () => craft((mem) => { mem[TIMER] = 0; mem[MODE] = 5; mem[INPLAY] = 0; }, SEAM_STUBS)],
  ]) {
    const r = withOmittedRet(cand, 0x0d11)(mk());
    assert.ok(!isIter(r), `the ${name} branch must not hand back a coroutine`);
  }
  console.log("  SEAM: no throw on timer/mode3/in-play/mode5 -> wireable");
});
