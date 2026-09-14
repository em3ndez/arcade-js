// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { DRAW_CURSOR_OFFSET, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";

// Store two 16-bit differences through a pointer at a running cursor: each
// difference's low byte goes out raw and its high byte is kept to 5 bits, with
// the pattern 0xa0 forced into the second high byte. The cursor advances four.
export function emitDeltaVectorPair(m) {
  const { mem8 } = m;
  let y = mem8[DRAW_CURSOR_OFFSET];
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);

  const d1 = u16((mem8[PROJ_X_LO] | (mem8[PROJ_X_HI] << 8)) - (mem8[PREV_X_LO] | (mem8[PREV_X_HI] << 8)));
  mem8[u16(base + y)] = d1; y = u8(y + 1);
  mem8[u16(base + y)] = (d1 >> 8) & 0x1f; y = u8(y + 1);

  const d2 = u16((mem8[PROJ_Y_LO] | (mem8[PROJ_Y_HI] << 8)) - (mem8[PREV_Y_LO] | (mem8[PREV_Y_HI] << 8)));
  mem8[u16(base + y)] = d2; y = u8(y + 1);
  mem8[u16(base + y)] = ((d2 >> 8) & 0x1f) | 0xa0; y = u8(y + 1);

  mem8[DRAW_CURSOR_OFFSET] = y;
}
