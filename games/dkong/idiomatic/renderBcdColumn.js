// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBcdColumn — draw a packed 3-byte BCD value as six digits climbing a video column.
 *
 * Caller-column entry into the packed-BCD renderer: given a source pointer (three packed
 * bytes, two BCD digits each) and a destination cell it paints six digits up that column, one
 * tilemap row per digit. Shares the digit loop with the fixed-cell score renderer.
 *
 * LIVE-OUT: the six digit cells in video RAM, plus the loop-exit registers the shared leaf leaves.
 */
import { expandBcdDigits } from "./expandBcdDigits.js";
import {
  BCD_RENDER_BYTE_COUNT,
  VRAM_ROW_STEP_UP,
} from "./names.js";


export function renderBcdColumn(m, src = m.regs.de, dest = m.regs.ix) {
  // The stride rides the return (a live-out the shared leaf does not re-seat).
  return expandBcdDigits(m, src, BCD_RENDER_BYTE_COUNT >> 8, dest, m.regs.de = VRAM_ROW_STEP_UP);
}
