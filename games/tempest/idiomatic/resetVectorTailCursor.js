// SPDX-License-Identifier: GPL-3.0-only
import { VECRAM_TAIL_CURSOR_LO, VECRAM_TAIL_CURSOR_HI } from "./names.js";
import { unpackLevelNibbleTables } from "./unpackLevelNibbleTables.js";

// Rebuild the packed nibble table, then seat the two-byte vector-tail value.
export function resetVectorTailCursor(m) {
  const { mem8 } = m;
  unpackLevelNibbleTables(m);
  mem8[VECRAM_TAIL_CURSOR_LO] = 0x7f;
  mem8[VECRAM_TAIL_CURSOR_HI] = 0x04;
}
