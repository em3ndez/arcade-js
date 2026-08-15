// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitRiverLane1Arrival — memory-equivalent to the frozen oracle at ROM 0x1C0D.
 * GATE: crafted-entry. The lane-1 commit steps the home-bay slot cursor on entry, then guards on arrival,
 * ticks the ride counter down and either marks arrival (home sprite + row-progress score) or carries the
 * frog FROG_Y -= the vertical delta. From a captured post-boot state the lane-1 cells are poked to drive
 * each branch; the score branch is exercised with PLAY_FLAG set so the award actually runs. Live-out is
 * memory-only; RAM compared, stack masked. Teeth: no-op, wrong sprite, undone carry; positive controls
 * that the carry moves the frog and that arrival advances the progress high-water mark.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y, FROG_SPRITE, PLAY_FLAG, FURTHEST, DIR, ARRIVAL, COUNTER, VDELTA } from "./_riverRide.js";
import { commitRiverLane1Arrival as cand } from "../rideRiverLaneAndCommitArrival.js";
import { loc_1c0d as oracle } from "../../translated/loc_1b8b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const arrival = () => craft((mem) => {
  mem[ARRIVAL[1]] = 0; mem[COUNTER[1]] = 1; mem[DIR[1]] = 1; mem[FROG_SPRITE] = 0x00;
  mem[PLAY_FLAG] = 1; mem[FROG_Y] = 0x40; mem[FURTHEST] = 0x80; // in the scoring band, a new record
});
const carry = () => craft((mem) => { mem[ARRIVAL[1]] = 0; mem[COUNTER[1]] = 2; mem[VDELTA] = 3; mem[FROG_Y] = 0x50; });
const guarded = () => craft((mem) => { mem[ARRIVAL[1]] = 0x77; });

test("EQUAL (crafted): commitRiverLane1Arrival == oracle on guard/arrival+score/carry", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, guarded()), null, "the already-arrived guard diverged (slot cursor still steps)");
  assert.equal(ramDiff(oracle, cand, arrival()), null, "the ride-complete + score path diverged");
  assert.equal(ramDiff(oracle, cand, carry()), null, "the mid-ride carry path diverged");
  const c = carry(); const y0 = c.mem8[FROG_Y]; const a = c.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_Y], y0, "carry path not exercised: frog Y never moved");
  const s = arrival(); const f0 = s.mem8[FURTHEST]; const b = s.clone(); oracle(b);
  assert.notEqual(b.mem8[FURTHEST], f0, "score path not exercised: high-water mark never moved");
  console.log(`  EQUAL: guard/arrival+score/carry; carry Y ${y0}->${a.mem8[FROG_Y]}, furthest ${f0}->${b.mem8[FURTHEST]}`);
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
