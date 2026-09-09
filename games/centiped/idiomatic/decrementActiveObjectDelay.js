// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";
import { loc_88, loc_8d, loc_94 } from "./names.js";

/**
 * decrementActiveObjectDelay -- tick down the active object's per-slot delay counter, then hand off to the
 * accumulator-advance spine. Saves the caller index, indexes the delay bank by the active-object cell,
 * decrements that entry, and falls through, passing the step through to the accumulator advance. [code]
 */
export function decrementActiveObjectDelay(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  mem8[loc_8d] = x; // save the caller index; the spine restores X from here
  const obj = mem8[loc_88]; // active-object selector
  mem8[(loc_94 + obj) & 0xff] = u8(mem8[(loc_94 + obj) & 0xff] - 1); // tick the delay counter
  return advancePathAccumulator(m, a, x); // fall through into the accumulator-advance spine
}
