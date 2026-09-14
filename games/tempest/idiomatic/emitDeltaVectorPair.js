// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { DRAW_CURSOR_OFFSET, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";

/**
 * emitDeltaVectorPair — emit two 16-bit coordinate deltas as vector-generator words at the
 * running draw cursor. ROM 0xc73c.
 *
 * Role in the machine: the vector generator draws lines as relative moves, so after a point
 * is projected Tempest emits the difference between where it is now and where it was, once
 * per axis. This routine computes the X delta (projected loc_63:64 minus previous loc_6c:6d)
 * and the Y delta (projected loc_61:62 minus previous loc_6a:6b) and writes each as a
 * little-endian word into the display list, masking the high bytes to five bits and stamping
 * the second word's high byte with the 0xa0 vector opcode. The cursor index loc_a9 advances
 * by four, so two delta words are appended per call.
 *
 * Behavior: y = cursor index loc_a9; base = 16-bit draw pointer loc_74:75. First delta d1 =
 * u16(PROJ_X - PREV_X): store low byte at base+y (y++), then high byte masked 0x1f at base+y
 * (y++). Second delta d2 = u16(PROJ_Y - PREV_Y): store low byte (y++), then (high & 0x1f) |
 * 0xa0 (y++). Write y back to the cursor index.
 *
 * Live-out: four bytes appended through the draw pointer (two delta words) and the cursor
 * index loc_a9 advanced by four. Grounding: [seen].
 */
export function emitDeltaVectorPair(m) {
  const { mem8 } = m;
  let y = mem8[DRAW_CURSOR_OFFSET];
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);

  // X delta: projected X minus previous X. Low byte raw, high byte clipped to 5 bits.
  const d1 = u16((mem8[PROJ_X_LO] | (mem8[PROJ_X_HI] << 8)) - (mem8[PREV_X_LO] | (mem8[PREV_X_HI] << 8)));
  mem8[u16(base + y)] = d1; y = u8(y + 1);
  mem8[u16(base + y)] = (d1 >> 8) & 0x1f; y = u8(y + 1);

  // Y delta: projected Y minus previous Y. High byte clipped to 5 bits and OR'd with the
  // 0xa0 vector opcode that terminates the delta-word pair.
  const d2 = u16((mem8[PROJ_Y_LO] | (mem8[PROJ_Y_HI] << 8)) - (mem8[PREV_Y_LO] | (mem8[PREV_Y_HI] << 8)));
  mem8[u16(base + y)] = d2; y = u8(y + 1);
  mem8[u16(base + y)] = ((d2 >> 8) & 0x1f) | 0xa0; y = u8(y + 1);

  mem8[DRAW_CURSOR_OFFSET] = y;
}
