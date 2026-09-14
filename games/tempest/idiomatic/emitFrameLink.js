// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI, POINTER_PARITY, SCORE_DISPLAY_TIMER, VEC_LIST_HEADER_LO, VECHEAD0_PLAY, DRAW_PTR_EVEN_LO, DRAW_PTR_TABLE_A } from "./names.js";

// If the source byte differs from the checkpoint byte, publish it and return carry set. Otherwise copy a
// two-byte record (selected by a mode flag) through the working pointer, reload that pointer from another
// record, and return carry clear.
export function emitFrameLink(m) {
  const { mem8 } = m;
  const src = mem8[VECHEAD0_PLAY];
  if (src !== mem8[VEC_LIST_HEADER_LO]) {
    mem8[VEC_LIST_HEADER_LO] = src;
    return true;  // carry set (the caller branches on this)
  }
  const x = mem8[POINTER_PARITY] !== 0 ? 0x08 : 0x02;   // mode flag picks the record slot
  const ptr = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);
  mem8[SCORE_DISPLAY_TIMER] = 0;
  mem8[u16(ptr)] = mem8[u16(DRAW_PTR_EVEN_LO + x)];
  mem8[u16(ptr + 1)] = mem8[u16(DRAW_PTR_EVEN_LO + x + 1)];
  mem8[DRAW_CURSOR_LO] = mem8[u16(DRAW_PTR_TABLE_A + x)];
  mem8[DRAW_CURSOR_HI] = mem8[u16(DRAW_PTR_TABLE_A + x + 1)];
  return false;  // carry clear (the copy path ran)
}
