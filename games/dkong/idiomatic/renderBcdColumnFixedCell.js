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

const ROW_STEP = 0xffe0; // back one tilemap row per digit (draws up a column)
const BYTE_COUNT = 0x0304; // 3 source bytes → 6 digits; low byte is a dead marker

export function renderBcdColumnFixedCell(m, enteredAt057C = false) {
  const { regs } = m;

  if (!enteredAt057C) {
    regs.ix = 0x7641; // the fixed destination cell (skipped on the second entry)
  }
  regs.exDeHl(); // source pointer arrives in a register; drop what it displaces
  regs.de = ROW_STEP;
  regs.bc = BYTE_COUNT;

  expandBcdDigits(m);
}
