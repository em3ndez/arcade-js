// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBcdColumn — draw a packed 3-byte BCD value as six digits up a video column.
 *
 * A caller-supplied entry into the packed-BCD renderer: given a source pointer (three
 * packed bytes, two BCD digits each) and a destination video cell, it paints the six digits
 * climbing a column, one tilemap row up per digit. Same code as the fixed-cell score
 * renderer entered one instruction later, but it skips that entry's hard-wired destination
 * and honours the caller's, so the score column and the on-board bonus-item value share one
 * renderer. The prologue fixes the standard parameters, then falls into the shared loop.
 */
import { expandBcdDigits } from "./expandBcdDigits.js";
import {
  BCD_RENDER_BYTE_COUNT,
  VRAM_ROW_STEP_UP,
} from "./names.js";


export function renderBcdColumn(m) {
  const { regs } = m;

  regs.exDeHl();       // source pointer moves into the register the loop reads it from
  regs.de = VRAM_ROW_STEP_UP;
  regs.bc = BCD_RENDER_BYTE_COUNT;

  expandBcdDigits(m);
}
