// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI, DRAW_CURSOR_ALT_LO, DRAW_CURSOR_ALT_HI } from "./names.js";

// Swap the two 16-bit pointers so the shared cursors address the other structure.
export function loc_b944(m) {
  const { mem8 } = m;
  const lo = mem8[DRAW_CURSOR_LO]; // save the first pointer's low byte
  const hi = mem8[DRAW_CURSOR_HI]; // save the first pointer's high byte
  mem8[DRAW_CURSOR_LO] = mem8[DRAW_CURSOR_ALT_LO];
  mem8[DRAW_CURSOR_HI] = mem8[DRAW_CURSOR_ALT_HI];
  mem8[DRAW_CURSOR_ALT_LO] = lo;
  mem8[DRAW_CURSOR_ALT_HI] = hi;
}
