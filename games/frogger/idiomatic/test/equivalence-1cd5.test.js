// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFrogHopLeft — memory-equivalent to the frozen oracle at ROM 0x1CD5.
 * GATE: crafted-entry. The LEFT (horizontal) advance guards on arrival, ticks the hop counter down and
 * either marks arrival (rest sprite) or steps the frog FROG_X -= the horizontal delta + moving sprite.
 * From a captured post-boot state the LEFT cells are poked to drive the three branches. Live-out is
 * memory-only; RAM compared, stack masked. Teeth: no-op, wrong sprite, undone step; positive control.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_X, FROG_SPRITE, ACTIVE, ARRIVAL, COUNTER, HDELTA } from "./_frogHop.js";
import { advanceFrogHopLeft as cand } from "../animateFrogHop.js";
import { loc_1cd5 as oracle } from "../../translated/loc_1c41.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const arrival = () => craft((mem) => { mem[ARRIVAL[3]] = 0; mem[COUNTER[3]] = 1; mem[ACTIVE[3]] = 1; mem[FROG_SPRITE] = 0x00; });
const stepMid = () => craft((mem) => { mem[ARRIVAL[3]] = 0; mem[COUNTER[3]] = 2; mem[HDELTA] = 3; mem[FROG_X] = 0x60; });
const guarded = () => craft((mem) => { mem[ARRIVAL[3]] = 0x77; });

test("EQUAL (crafted): advanceFrogHopLeft == oracle on guard/arrival/step", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, guarded()), null, "the already-arrived guard diverged");
  assert.equal(ramDiff(oracle, cand, arrival()), null, "the hop-complete path diverged");
  assert.equal(ramDiff(oracle, cand, stepMid()), null, "the mid-hop step path diverged");
  const e = stepMid(); const before = e.mem8[FROG_X]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_X], before, "step path not exercised: frog X never moved");
  console.log(`  EQUAL: guard/arrival/step; step moved frog X ${before}->${a.mem8[FROG_X]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { cand(m); m.mem8[FROG_SPRITE] = (m.mem8[FROG_SPRITE] + 1) & 0xff; };
  const undoneStep = (m) => { const x = m.mem8[FROG_X]; cand(m); m.mem8[FROG_X] = x; };
  assert.ok(ramDiff(oracle, noOp, arrival()), "no-op twin escaped on arrival");
  assert.ok(ramDiff(oracle, wrongSprite, arrival()), "wrong-sprite twin escaped");
  assert.ok(ramDiff(oracle, undoneStep, stepMid()), "undone-step twin escaped");
  console.log("  TEETH: no-op, wrong-sprite, undone-step all caught");
});
