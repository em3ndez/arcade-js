// SPDX-License-Identifier: GPL-3.0-only
import { VECRAM_TAIL_CURSOR_LO, VECRAM_TAIL_CURSOR_HI } from "./names.js";
import { loc_c196 } from "./loc_c196.js";

// Rebuild the packed nibble table, then seat the two-byte vector-tail value.
export function loc_b888(m) {
  const { mem8 } = m;
  loc_c196(m);
  mem8[VECRAM_TAIL_CURSOR_LO] = 0x7f;
  mem8[VECRAM_TAIL_CURSOR_HI] = 0x04;
}
