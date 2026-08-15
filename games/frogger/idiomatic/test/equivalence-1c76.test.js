// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitRiverLane2Arrival — memory-equivalent to the frozen oracle at ROM 0x1C76.
 * GATE: crafted-entry. The lane-2 (horizontal) commit guards on arrival, ticks the ride counter down and
 * either marks arrival (home sprite) or carries the frog FROG_X += the horizontal delta + moving sprite.
 * From a captured post-boot state the lane-2 cells are poked to drive the three branches. Live-out is
 * memory-only; RAM compared, stack masked. Teeth: no-op, wrong sprite, undone carry; positive control.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_X, FROG_SPRITE, DIR, ARRIVAL, COUNTER, HDELTA } from "./_riverRide.js";
import { commitRiverLane2Arrival as cand } from "../rideRiverLaneAndCommitArrival.js";
import { loc_1c76 as oracle } from "../../translated/loc_1c41.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const arrival = () => craft((mem) => { mem[ARRIVAL[2]] = 0; mem[COUNTER[2]] = 1; mem[DIR[2]] = 1; mem[FROG_SPRITE] = 0x00; });
const carry = () => craft((mem) => { mem[ARRIVAL[2]] = 0; mem[COUNTER[2]] = 2; mem[HDELTA] = 3; mem[FROG_X] = 0x60; });
const guarded = () => craft((mem) => { mem[ARRIVAL[2]] = 0x77; });

test("EQUAL (crafted): commitRiverLane2Arrival == oracle on guard/arrival/carry", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, guarded()), null, "the already-arrived guard diverged");
  assert.equal(ramDiff(oracle, cand, arrival()), null, "the ride-complete path diverged");
  assert.equal(ramDiff(oracle, cand, carry()), null, "the mid-ride carry path diverged");
  const e = carry(); const before = e.mem8[FROG_X]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_X], before, "carry path not exercised: frog X never moved");
  console.log(`  EQUAL: guard/arrival/carry; carry moved frog X ${before}->${a.mem8[FROG_X]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { cand(m); m.mem8[FROG_SPRITE] = (m.mem8[FROG_SPRITE] + 1) & 0xff; };
  const undoneCarry = (m) => { const x = m.mem8[FROG_X]; cand(m); m.mem8[FROG_X] = x; };
  assert.ok(ramDiff(oracle, noOp, arrival()), "no-op twin escaped on arrival");
  assert.ok(ramDiff(oracle, wrongSprite, arrival()), "wrong-sprite twin escaped");
  assert.ok(ramDiff(oracle, undoneCarry, carry()), "undone-carry twin escaped");
  console.log("  TEETH: no-op, wrong-sprite, undone-carry all caught");
});
