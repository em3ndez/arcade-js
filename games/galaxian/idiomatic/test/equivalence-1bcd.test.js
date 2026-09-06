// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bcd — memory-equivalent to the frozen self-test mode dispatch at ROM 0x1bcd. It routes on the self-test
 * mode: 1 -> the sound + input scan, 2 -> the screen-fill strip, 3 -> the OBJRAM ramp fill/scan chain; any
 * other value is the reset arm (unreachable on a good boot). The frozen oracle seats a shared epilogue return
 * (0x00d8) and dispatches through the register seam; that epilogue only pops registers and re-arms the irq
 * latch (an io write, both excluded from the memory diff), so idiomatic direct dispatch is memory-equivalent.
 * EQUAL asserts idiomatic == oracle RAM on mode 1, 2, and 3 entries. TEETH: a wrong-branch dispatch diverges,
 * and the reset arm (mode 0 / 4) throws.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_1bcd as cand } from "../loc_1bcd.js";
import { loc_1bcd as oracle } from "../../translated/loc_1bcd.js";
import { loc_1be3 } from "../loc_1be3.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const RNG_SEED = 0x401e, PASS_COUNTER = 0x4008;

// mode 3: the fill/scan chain reloads the seed from RNG_SEED and needs the pass counter set.
function mode3(seed) {
  return craft((mem8, e) => { e.push16(0x9999); mem8[RNG_SEED] = seed; mem8[PASS_COUNTER] = 1; e.regs.a = 3; });
}
// mode 1/2: the already-idiomatic handlers read attract-seed cells; just set the mode selector.
function modeN(n) {
  return craft((mem8, e) => { e.push16(0x9999); e.regs.a = n; });
}

// wrong-branch twin: ignores the mode and always runs the mode-3 chain.
const alwaysMode3 = (m) => loc_1be3(m, m.mem8[RNG_SEED]);

test("EQUAL: loc_1bcd == oracle on mode 1, 2, 3", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, mode3(0x3c)), null, "mode 3 (fill/scan) diverged");
  assert.equal(ramDiff(oracle, cand, modeN(1)), null, "mode 1 (sound+input scan) diverged");
  assert.equal(ramDiff(oracle, cand, modeN(2)), null, "mode 2 (screen-fill strip) diverged");
  assert.ok(ramDiff(oracle, () => {}, mode3(0x3c)), "vacuous: mode 3 wrote no RAM");
  console.log("  EQUAL: loc_1bcd == oracle on modes 1/2/3");
});

test("TEETH: wrong-branch dispatch diverges; the reset arm throws", { skip }, () => {
  assert.ok(ramDiff(oracle, alwaysMode3, modeN(1)), "the always-mode-3 twin escaped on a mode-1 entry");
  assert.throws(() => cand(modeN(0)), "mode 0 (reset arm) did not throw");
  assert.throws(() => cand(modeN(4)), "mode 4 (reset arm) did not throw");
  console.log("  TEETH: wrong-branch diverges; reset arm throws");
});
