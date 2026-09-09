// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";
import { loc_88, loc_8d, loc_94 } from "./names.js";

/**
 * decrementActiveObjectDelay -- tick down the active object's per-slot delay counter, then hand off to the
 * accumulator-advance spine. Saves the caller index, indexes the delay bank by the active-object cell,
 * decrements that entry, and falls through. [code]
 * The caller's A passes through unchanged into the frozen advance via the register bridge (R37).
 */
export function decrementActiveObjectDelay(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_8d] = x; // save the caller index; the spine restores X from here
  const obj = mem8[loc_88]; // active-object selector
  mem8[(loc_94 + obj) & 0xff] = u8(mem8[(loc_94 + obj) & 0xff] - 1); // tick the delay counter
  return advancePathAccumulator(m); // fall through into the accumulator-advance spine
}
