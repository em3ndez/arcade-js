// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFlyEatCollision — memory-equivalent to the frozen oracle at ROM 0x26A6.
 * GATE: crafted-entry. The fly-eat step tracks the fly onto the frog while an eat runs, else arms the
 * tongue once, bails to the retract reset when the retract bit is set, and box-tests the fly against the
 * frog while the tongue is out. From a captured post-boot state the gate pokes COLLISION_SUBFLAG (eat in
 * progress), the fly path/latch/retract cells, and a deterministic HIT (pre-running the fly mover to
 * learn the fly X, then placing the frog on it in the row band). Live-out memory-only; RAM compared,
 * stack masked. Teeth: no-op, dropped eat-latch, skipped tongue-arm; positive control the box hit latches
 * the eat (0x8134 0->1).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, PLAY_FLAG, FROG_X, FROG_SPRITE, FROG_Y } from "./_frogHop.js";
import { animateFlyEatCollision as cand } from "../animateFlyEatCollision.js";
import { driveFlyPatrol } from "../driveFlyPatrol.js";
import { loc_26a6 as oracle } from "../../translated/loc_26a6.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SUBFLAG = 0x8134, LATCH = 0x8135, EAT_PHASE = 0x813d, PATH = 0x811c, FLY_X = 0x8040;
const TONGUE_TIMER = 0x833e, STEP = 0x833d;

const eatInProgress = () => craft((mem) => { mem[SUBFLAG] = 1; mem[FROG_X] = 0x77; mem[FROG_SPRITE] = 0x33; mem[FROG_Y] = 0x62; });
const noopRet = () => craft((mem) => { mem[SUBFLAG] = 0; mem[PATH] = 1; mem[EAT_PHASE] = 0; mem[LATCH] = 0; });
const retract = () => craft((mem) => { mem[SUBFLAG] = 0; mem[PATH] = 1; mem[EAT_PHASE] = 1; mem[LATCH] = 1; });
const armTongue = () => craft((mem) => { mem[SUBFLAG] = 0; mem[PATH] = 0; mem[LATCH] = 0; });

const hitBase = (mem) => {
  mem[SUBFLAG] = 0; mem[PATH] = 1; mem[EAT_PHASE] = 0; mem[LATCH] = 1;
  mem[FROG_Y] = 0x60; mem[TONGUE_TIMER] = 4; mem[STEP] = 0; mem[PLAY_FLAG] = 1;
};
// The fly mover repositions FLY_X from its path table; pre-run it so the frog can be placed on the hit.
function boxHit() {
  const p = craft(hitBase); driveFlyPatrol(p); const flyX = p.mem8[FLY_X];
  return craft((mem) => { hitBase(mem); mem[FROG_X] = flyX; });
}

test("EQUAL (crafted): animateFlyEatCollision == oracle on eat/idle/retract/arm/box-hit", { skip }, () => {
  for (const [name, mk] of [["eat-track", eatInProgress], ["idle-ret", noopRet], ["retract", retract], ["arm-tongue", armTongue], ["box-hit", boxHit]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = boxHit(); const before = e.mem8[SUBFLAG]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[SUBFLAG], before, "box-hit not exercised: eat never latched");
  console.log(`  EQUAL: eat-track/idle-ret/retract/arm-tongue/box-hit; hit latched eat ${before}->${a.mem8[SUBFLAG]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noLatch = (m) => { cand(m); m.mem8[SUBFLAG] = 0; };
  const skipArm = (m) => { m.mem8[LATCH] = 1; }; // stamps only the latch, skips the sprite descriptor
  assert.ok(ramDiff(oracle, noOp, eatInProgress()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, noLatch, boxHit()), "dropped-latch twin escaped");
  assert.ok(ramDiff(oracle, skipArm, armTongue()), "skipped-arm twin escaped");
  console.log("  TEETH: no-op, dropped-eat-latch, skipped-tongue-arm all caught");
});
