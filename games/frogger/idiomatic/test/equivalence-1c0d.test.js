// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFrogHopUp — memory-equivalent to the frozen oracle at ROM 0x1C0D.
 * GATE: crafted-entry. The UP advance steps the home-bay slot cursor on entry, then guards on arrival,
 * ticks the hop counter down and either marks arrival (rest sprite + row-progress score) or steps the
 * frog FROG_Y -= the vertical delta. From a captured post-boot state the UP cells are poked to drive
 * each branch; the score branch is exercised with PLAY_FLAG set so the award actually runs. Live-out is
 * memory-only; RAM compared, stack masked. Teeth: no-op, wrong sprite, undone step; positive controls
 * that the step moves the frog and that arrival advances the progress high-water mark.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y, FROG_SPRITE, PLAY_FLAG, FURTHEST, ACTIVE, ARRIVAL, COUNTER, VDELTA } from "./_frogHop.js";
import { advanceFrogHopUp as cand } from "../animateFrogHop.js";
import { loc_1c0d as oracle } from "../../translated/loc_1b8b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const arrival = () => craft((mem) => {
  mem[ARRIVAL[1]] = 0; mem[COUNTER[1]] = 1; mem[ACTIVE[1]] = 1; mem[FROG_SPRITE] = 0x00;
  mem[PLAY_FLAG] = 1; mem[FROG_Y] = 0x40; mem[FURTHEST] = 0x80; // in the scoring band, a new record
});
const stepMid = () => craft((mem) => { mem[ARRIVAL[1]] = 0; mem[COUNTER[1]] = 2; mem[VDELTA] = 3; mem[FROG_Y] = 0x50; });
const guarded = () => craft((mem) => { mem[ARRIVAL[1]] = 0x77; });

test("EQUAL (crafted): advanceFrogHopUp == oracle on guard/arrival+score/step", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, guarded()), null, "the already-arrived guard diverged (slot cursor still steps)");
  assert.equal(ramDiff(oracle, cand, arrival()), null, "the hop-complete + score path diverged");
  assert.equal(ramDiff(oracle, cand, stepMid()), null, "the mid-hop step path diverged");
  const c = stepMid(); const y0 = c.mem8[FROG_Y]; const a = c.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_Y], y0, "step path not exercised: frog Y never moved");
  const s = arrival(); const f0 = s.mem8[FURTHEST]; const b = s.clone(); oracle(b);
  assert.notEqual(b.mem8[FURTHEST], f0, "score path not exercised: high-water mark never moved");
  console.log(`  EQUAL: guard/arrival+score/step; step Y ${y0}->${a.mem8[FROG_Y]}, furthest ${f0}->${b.mem8[FURTHEST]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { cand(m); m.mem8[FROG_SPRITE] = (m.mem8[FROG_SPRITE] + 1) & 0xff; };
  const undoneStep = (m) => { const y = m.mem8[FROG_Y]; cand(m); m.mem8[FROG_Y] = y; };
  assert.ok(ramDiff(oracle, noOp, arrival()), "no-op twin escaped on arrival");
  assert.ok(ramDiff(oracle, wrongSprite, arrival()), "wrong-sprite twin escaped");
  assert.ok(ramDiff(oracle, undoneStep, stepMid()), "undone-step twin escaped");
  console.log("  TEETH: no-op, wrong-sprite, undone-step all caught");
});
