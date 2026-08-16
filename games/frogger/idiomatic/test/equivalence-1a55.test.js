// SPDX-License-Identifier: GPL-3.0-only
/**
 * orchestrateCollisionsAndFrogInput — memory-equivalent to the frozen oracle at ROM 0x1a55.
 * GATE: crafted-entry (spine dispatcher). PLAY_FLAG 0x83fe clear tails straight to the shared exit; set,
 * it runs the collision sub-engines, the HOME_GOAL_SPRITE_ARM_CELL timing arm, the slot tick, then the LIVES_COUNT-bit0
 * scroll stage (inline fly/slot arm, or the gator/slot arm), and finally the shared exit — a low frog
 * row (0x8047<0x31) tails to the still-translated goal scan 0x1cff, else the input scan. Dissolves the
 * moved-0 leaves; keeps m.call for the tail-transferring dive driver 0x27ea, goal scan 0x1cff, and the
 * un-lifted 0x27de. Live-out memory-only; RAM compared, stack masked. Teeth: no-op, skipped/ wrong
 * scroll-counter effect. Positive control: the scroll counter 0x8122 arms 0->1 when the body runs.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, SEAM_STUBS } from "./_spineDispatch.js";
import { orchestrateCollisionsAndFrogInput as cand } from "../orchestrateCollisionsAndFrogInput.js";
import { loc_1a55 as oracle } from "../../translated/loc_1a55.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const PLAY = 0x83fe, FROGY = 0x8047, B7 = 0x83b7, SCNT = 0x8122, GATE8340 = 0x8340, HIT = 0x833e;

const play0High = () => craft((mem) => { mem[PLAY] = 0; mem[FROGY] = 0x50; });
const play0Low = () => craft((mem) => { mem[PLAY] = 0; mem[FROGY] = 0x10; });
const bodyBit0Set = () => craft((mem) => { mem[PLAY] = 1; mem[FROGY] = 0x50; mem[B7] = 0x01; });
const bodyBit0Clr = () => craft((mem) => { mem[PLAY] = 1; mem[FROGY] = 0x50; mem[B7] = 0x00; });
const bodyTiming = () => craft((mem) => { mem[PLAY] = 1; mem[FROGY] = 0x50; mem[B7] = 0x01; mem[GATE8340] = 2; });

test("EQUAL (crafted): orchestrateCollisionsAndFrogInput == oracle on guard + goal-scan + body", { skip }, () => {
  for (const [name, mk] of [["play0-high", play0High], ["play0-low-goalscan", play0Low],
                            ["body-bit0set", bodyBit0Set], ["body-bit0clr", bodyBit0Clr], ["body-timing", bodyTiming]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = bodyBit0Set(); const before = e.mem8[SCNT]; const a = e.clone(); oracle(a);
  assert.equal(before, 0, "positive control seed: 0x8122 starts at 0");
  assert.equal(a.mem8[SCNT], 1, "positive control: the body arms the scroll counter 0x8122 0->1");
  console.log("  EQUAL: play0-high/play0-low-goalscan/body-bit0set/body-bit0clr/body-timing; control 0x8122 0->1");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipCounter = (m) => { cand(m); m.mem8[SCNT] = 0; };
  const wrongHit = (m) => { cand(m); m.mem8[HIT] = (m.mem8[HIT] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, bodyBit0Set()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipCounter, bodyBit0Set()), "skip-counter twin escaped");
  assert.ok(ramDiff(oracle, wrongHit, bodyBit0Set()), "wrong-hit twin escaped");
  console.log("  TEETH: no-op, skip-counter, wrong-hit all caught");
});

test("SEAM: wireable — delta-0/+2 return on guard + goal-scan + body", { skip }, () => {
  const isIter = (r) => r && typeof r.next === "function" && typeof r.throw === "function";
  for (const [name, mk] of [
    ["play0-high", () => craft((mem) => { mem[PLAY] = 0; mem[FROGY] = 0x50; }, SEAM_STUBS)],
    ["play0-low-goalscan", () => craft((mem) => { mem[PLAY] = 0; mem[FROGY] = 0x10; }, SEAM_STUBS)],
    ["body", () => craft((mem) => { mem[PLAY] = 1; mem[FROGY] = 0x50; mem[B7] = 0x01; }, SEAM_STUBS)],
  ]) {
    const r = withOmittedRet(cand, 0x1a55)(mk());
    assert.ok(!isIter(r), `the ${name} branch must not hand back a coroutine`);
  }
  console.log("  SEAM: no throw on play0-high/play0-low-goalscan/body -> wireable");
});
