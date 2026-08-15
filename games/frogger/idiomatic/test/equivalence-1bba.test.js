// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFrogHopDown — memory-equivalent to the frozen oracle at ROM 0x1BBA.
 * GATE: crafted-entry (the handler fires only for a mid-hop frog, which attract never reaches). From a
 * captured post-boot state the DOWN cells are poked to drive the three branches: already-arrived guard,
 * hop complete (counter drains -> arrival mark + rest sprite), and mid-hop (frog stepped FROG_Y += the
 * vertical delta + moving sprite). Live-out is memory-only; RAM is compared, the dead stack scratch masked.
 * Teeth: no-op, wrong sprite, undone step; positive control that the step actually moves the frog.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y, FROG_SPRITE, ACTIVE, ARRIVAL, COUNTER, VDELTA } from "./_frogHop.js";
import { advanceFrogHopDown as cand } from "../animateFrogHop.js";
import { loc_1bba as oracle } from "../../translated/loc_1b8b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const arrival = () => craft((mem) => { mem[ARRIVAL[0]] = 0; mem[COUNTER[0]] = 1; mem[ACTIVE[0]] = 1; mem[FROG_SPRITE] = 0x00; });
const stepMid = () => craft((mem) => { mem[ARRIVAL[0]] = 0; mem[COUNTER[0]] = 2; mem[VDELTA] = 3; mem[FROG_Y] = 0x50; });
const guarded = () => craft((mem) => { mem[ARRIVAL[0]] = 0x77; });

test("EQUAL (crafted): advanceFrogHopDown == oracle on guard/arrival/step", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, guarded()), null, "the already-arrived guard diverged");
  assert.equal(ramDiff(oracle, cand, arrival()), null, "the hop-complete path diverged");
  assert.equal(ramDiff(oracle, cand, stepMid()), null, "the mid-hop step path diverged");
  // Positive control: the step actually moved the frog (not a vacuous match).
  const e = stepMid();
  const before = e.mem8[FROG_Y];
  const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_Y], before, "step path not exercised: frog Y never moved");
  console.log(`  EQUAL: guard/arrival/step; step moved frog Y ${before}->${a.mem8[FROG_Y]}`);
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
