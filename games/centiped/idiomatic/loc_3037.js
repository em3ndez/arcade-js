// SPDX-License-Identifier: GPL-3.0-only
import { loc_8b } from "./names.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";
import { loc_303e } from "./loc_303e.js";

/**
 * loc_3037 (ROM 0x3037) -- the top front-door onto the BCD path-accumulator chain. This is one entry
 * near the head of a fall-through spine that both advances a segment's scripted decimal position and
 * resets the per-slot timer, row, and fixup state around it. loc_3037's own job is small: it plants
 * the caller's Y as the step addend the accumulator will add, seeds the advance with a zero A, runs
 * the BCD advance, then drops into the seed routine below.
 * Live-out: $8b = step addend; then whatever advancePathAccumulator + the loc_303e chain leave. [code]
 */
export function loc_3037(m, y = m.regs.y) {
  // Park Y at $8b as the addend advancePathAccumulator will fold into the running BCD position.
  m.mem8[loc_8b] = y; // step addend for the advance
  // Run the BCD advance with a cleared A seed (0x00) -- the accumulator adds $8b to the position.
  advancePathAccumulator(m, 0x00); // advance (seed A = 0)
  // Fall through into the seed routine that arms the timer cell and frees the slot's row byte.
  return loc_303e(m); // fall through
}
