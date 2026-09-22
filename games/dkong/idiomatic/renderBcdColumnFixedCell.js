// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBcdColumnFixedCell — draw a packed 3-byte BCD counter as six digits up a fixed video column.
 * Fixed-destination entry into the packed-BCD renderer: the caller hands a source pointer (three
 * packed bytes, two digits each) and this entry hard-wires the destination cell, then paints six
 * digits climbing the column. A second caller enters one instruction later with its own column
 * chosen and skips the fixed-cell store; everything after is shared. Source bytes are walked
 * backwards, so descending source renders into ascending display cells.
 * NOT CLAIMED: which counter the fixed cell displays — the name states the mechanism only.
 * LIVE-OUT: memory-only — the six digit cells written into video RAM.
 */
import { expandBcdDigits } from "./expandBcdDigits.js";
import {
  BCD_RENDER_BYTE_COUNT,
  VRAM_ROW_STEP_UP,
  HIGH_SCORE_DISPLAY_CELL,
} from "./names.js";


export function renderBcdColumnFixedCell(m, enteredAt057C = false, src = m.regs.de) {
  // Fixed entry hard-wires its destination cell; the shared entry keeps the caller's column.
  const dest = enteredAt057C ? undefined : HIGH_SCORE_DISPLAY_CELL;

  // The source pointer arrives in DE (src); the DE stride rides the return (a live-out the leaf
  // does not re-seat); the byte count B is the high byte of BCD_RENDER_BYTE_COUNT.
  return expandBcdDigits(m, src, BCD_RENDER_BYTE_COUNT >> 8, dest, m.regs.de = VRAM_ROW_STEP_UP);
}
