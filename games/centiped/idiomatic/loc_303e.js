// SPDX-License-Identifier: GPL-3.0-only
import { loc_34, loc_b2 } from "./names.js";
import { loc_3046 } from "./loc_3046.js";

/**
 * loc_303e — seed two zero-page cells, then fall through to the tail routine. Arms the $b2 cell to
 * 0x13 and frees slot X's row byte (= 0xff, high bit set). [code]
 */
export function loc_303e(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_b2] = 0x13; // arm the timer cell
  mem8[(loc_34 + x) & 0xff] = 0xff; // free slot X's row byte
  return loc_3046(m); // fall through
}
