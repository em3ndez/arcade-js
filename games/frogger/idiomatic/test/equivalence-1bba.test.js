// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitRiverLane0Arrival — memory-equivalent to the frozen oracle at ROM 0x1BBA.
 * GATE: crafted-entry (the handler fires only for a riding frog, which attract never reaches). From a
 * captured post-boot state the lane-0 cells are poked to drive the three branches: already-arrived guard,
 * ride complete (counter drains -> arrival mark + home sprite), and mid-ride (frog carried FROG_Y += the
 * vertical delta + moving sprite). Live-out is memory-only; RAM is compared, the dead stack scratch masked.
 * Teeth: no-op, wrong sprite, undone carry; positive control that the carry actually moves the frog.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y, FROG_SPRITE, DIR, ARRIVAL, COUNTER, VDELTA } from "./_riverRide.js";
import { commitRiverLane0Arrival as cand } from "../rideRiverLaneAndCommitArrival.js";
import { loc_1bba as oracle } from "../../translated/loc_1b8b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const arrival = () => craft((mem) => { mem[ARRIVAL[0]] = 0; mem[COUNTER[0]] = 1; mem[DIR[0]] = 1; mem[FROG_SPRITE] = 0x00; });
const carry = () => craft((mem) => { mem[ARRIVAL[0]] = 0; mem[COUNTER[0]] = 2; mem[VDELTA] = 3; mem[FROG_Y] = 0x50; });
const guarded = () => craft((mem) => { mem[ARRIVAL[0]] = 0x77; });

test("EQUAL (crafted): commitRiverLane0Arrival == oracle on guard/arrival/carry", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, guarded()), null, "the already-arrived guard diverged");
  assert.equal(ramDiff(oracle, cand, arrival()), null, "the ride-complete path diverged");
  assert.equal(ramDiff(oracle, cand, carry()), null, "the mid-ride carry path diverged");
  // Positive control: the carry actually moved the frog (not a vacuous match).
  const e = carry();
  const before = e.mem8[FROG_Y];
  const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_Y], before, "carry path not exercised: frog Y never moved");
  console.log(`  EQUAL: guard/arrival/carry; carry moved frog Y ${before}->${a.mem8[FROG_Y]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { cand(m); m.mem8[FROG_SPRITE] = (m.mem8[FROG_SPRITE] + 1) & 0xff; };
  const undoneCarry = (m) => { const y = m.mem8[FROG_Y]; cand(m); m.mem8[FROG_Y] = y; };
  assert.ok(ramDiff(oracle, noOp, arrival()), "no-op twin escaped on arrival");
  assert.ok(ramDiff(oracle, wrongSprite, arrival()), "wrong-sprite twin escaped");
  assert.ok(ramDiff(oracle, undoneCarry, carry()), "undone-carry twin escaped");
  console.log("  TEETH: no-op, wrong-sprite, undone-carry all caught");
});
