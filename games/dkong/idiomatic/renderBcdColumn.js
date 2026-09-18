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

const ROW_STEP = 0xffe0; //  -0x20: back one tilemap row per digit (draws up a column)
const BYTE_COUNT = 0x0304; // 3 source bytes (six digits); the low byte is a dead marker

export function renderBcdColumn(m) {
  const { regs } = m;

  regs.exDeHl();       // source pointer moves into the register the loop reads it from
  regs.de = ROW_STEP;
  regs.bc = BYTE_COUNT;

  expandBcdDigits(m);
}
