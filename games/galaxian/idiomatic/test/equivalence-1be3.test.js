// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1be3 — memory-equivalent to the frozen self-test OBJRAM ramp fill at ROM 0x1be3. It lays a stepped
 * colour ramp (seed +0x2f per cell) across the 256-byte OBJRAM page, then reloads the seed from RNG_SEED and
 * falls into the ramp scan (loc_1bed). A crafted entry seats HL = OBJRAM and A = seed (as loc_1bcd hands over)
 * and sets RNG_SEED to the same seed so the scan the fill feeds matches. EQUAL asserts idiomatic == oracle RAM
 * across seeds and pass counts (the fill + the scan's final-pass seeding are the observable effects). TEETH:
 * a no-op leaves the ramp unlaid, and a wrong-step fill diverges.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_1be3 as cand } from "../loc_1be3.js";
import { loc_1be3 as oracle } from "../../translated/loc_1be3.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const OBJRAM = 0x5800, RNG_SEED = 0x401e, PASS_COUNTER = 0x4008;

function entry(seed, passes) {
  return craft((mem8, e) => {
    e.push16(0x9999);
    mem8[RNG_SEED] = seed;   // the scan seed loc_1be3 reloads before falling into the scan
    mem8[PASS_COUNTER] = passes;
    e.regs.hl = OBJRAM;      // oracle fills from HL
    e.regs.a = seed;         // fill seed
  });
}

// A broken twin: fills with the wrong step, so the ramp it lays differs from the oracle's.
function brokenStep(m) {
  const { mem8 } = m;
  let v = m.regs.a & 0xff;
  for (let i = 0; i < 0x100; i++) { mem8[OBJRAM + i] = v; v = (v + 0x2e) & 0xff; } // BUG: 0x2e not 0x2f
}

test("EQUAL: loc_1be3 == oracle across seeds and pass counts", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry(0x3c, 1)), null, "seed 0x3c final-pass diverged");
  assert.equal(ramDiff(oracle, cand, entry(0x55, 2)), null, "seed 0x55 early-ret diverged");
  assert.ok(ramDiff(oracle, () => {}, entry(0x3c, 1)), "vacuous: oracle laid no ramp");
  console.log("  EQUAL: loc_1be3 == oracle (fill + fall-through scan)");
});

test("TEETH: no-op and wrong-step fill are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, () => {}, entry(0x3c, 1)), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, brokenStep, entry(0x3c, 1)), "the wrong-step fill twin escaped");
  console.log("  TEETH: no-op + wrong-step fill caught");
});
