// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-0870 — crafted-entry gate: driveScoreDisplayCountdown vs the frozen oracle. Covers the
 * two guards, the countdown-still and countdown-drain paths, the bar-tile-5 sub-branch, the no-more-frogs
 * tail, the first-entry seed, and the bonus arm; teeth catch a no-op, a skipped countdown tick, and a
 * wrong bar cell; positive control proves the countdown byte moves. LAYOUT poked so the once-only field
 * layout stays inert and preserves the crafted counters.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { driveScoreDisplayCountdown as cand } from "../driveScoreDisplayCountdown.js";
import { loc_0870 as oracle } from "../../translated/loc_0870.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const GUARD = 0x83cd, HOLD = 0x8004, SEED = 0x83ae, ARM = 0x83df;
const CD = 0x83dc, DD = 0x83dd, DELO = 0x83de, E0 = 0x83e0, LAYOUT = 0x842d, PLAY = 0x83fe;

const armed = (mem) => { mem[GUARD] = 0; mem[HOLD] = 0; mem[SEED] = 1; mem[ARM] = 0; mem[LAYOUT] = 1; };
const guarded = () => craft((mem) => { mem[GUARD] = 1; });
const held = () => craft((mem) => { mem[GUARD] = 0; mem[HOLD] = 1; });
const firstEntry = () => craft((mem) => { mem[GUARD] = 0; mem[HOLD] = 0; mem[SEED] = 0; mem[ARM] = 0; mem[LAYOUT] = 1; mem[CD] = 5; });
const still = () => craft((mem) => { armed(mem); mem[CD] = 5; });
const drain = () => craft((mem) => { armed(mem); mem[CD] = 1; mem[DD] = 3; mem[DELO] = 0x42; });
const tile5 = () => craft((mem) => { armed(mem); mem[CD] = 1; mem[DD] = 3; mem[DELO] = 0x11; });
const noFrogs = () => craft((mem) => { armed(mem); mem[CD] = 1; mem[DD] = 0; });
const arm = () => craft((mem) => { mem[GUARD] = 0; mem[HOLD] = 0; mem[SEED] = 1; mem[ARM] = 1; mem[LAYOUT] = 1; mem[E0] = 0; mem[DELO] = 0x42; mem[PLAY] = 1; });

test("EQUAL: driveScoreDisplayCountdown == oracle on every branch", { skip }, () => {
  for (const [name, mk] of [
    ["guarded", guarded], ["held", held], ["first-entry", firstEntry], ["still", still],
    ["drain", drain], ["tile5", tile5], ["no-frogs", noFrogs], ["arm", arm],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = still(); const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[CD], e.mem8[CD], "vacuous: countdown never ticked");
  console.log(`  EQUAL: 8 branches; still ticked countdown ${e.mem8[CD]}->${a.mem8[CD]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipTick = (m) => { const cd = m.mem8[CD]; cand(m); m.mem8[CD] = cd; };
  const wrongBar = (m) => { cand(m); m.mem8[0xa8df] = (m.mem8[0xa8df] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, drain()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipTick, still()), "skip-tick twin escaped");
  assert.ok(ramDiff(oracle, wrongBar, drain()), "wrong-bar twin escaped");
  console.log("  TEETH: no-op, skip-tick, wrong-bar all caught");
});
