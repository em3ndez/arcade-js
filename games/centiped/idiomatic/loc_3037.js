// SPDX-License-Identifier: GPL-3.0-only
import { loc_8b } from "./names.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";
import { loc_303e } from "./loc_303e.js";

/**
 * loc_3037 — stash Y as the step addend at $8b and zero the accumulator seed, run the BCD advance,
 * then fall through to the seed routine. [code]
 */
export function loc_3037(m, y = m.regs.y) {
  m.mem8[loc_8b] = y; // step addend for the advance
  advancePathAccumulator(m, 0x00); // advance (seed A = 0)
  return loc_303e(m); // fall through
}
