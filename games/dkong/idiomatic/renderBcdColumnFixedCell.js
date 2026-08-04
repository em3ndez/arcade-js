// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBcdColumnFixedCell — draw a packed 3-byte BCD counter as six digits up a fixed video
 * column.
 *
 * The fixed-destination entry into the packed-BCD renderer. The caller hands over a source pointer
 * — three packed bytes, two digits each — and this entry hard-wires the destination video cell
 * itself, then paints the six digits climbing that column, one tilemap row up per digit. The same
 * code is also entered one instruction later by a caller that has already chosen its own column,
 * and that second mode skips the fixed-cell store; everything after it is shared.
 *
 * The prologue fixes the destination and the standard render parameters, then falls into the
 * shared digit-expansion loop:
 *
 *   - the fixed destination cell is loaded, UNLESS the caller entered past that store;
 *   - the source pointer, which arrives in a register, is moved into place, and the value it
 *     displaces is overwritten immediately and discarded;
 *   - the per-digit stride is set to minus one tilemap row, so successive digits climb the column;
 *   - the count is set to 3 source bytes, i.e. 6 digits;
 *   - the expansion loop then emits, for each source byte, the HIGH nibble and then the LOW,
 *     walking the source pointer backwards — so descending source bytes render into ascending
 *     display cells — and stepping the destination by the stride.
 *
 * NOT CLAIMED: what the fixed cell displays. The column is hard-wired here, but nothing in this
 * routine establishes which counter it belongs to, so the name states the mechanism only.
 *
 * LIVE-OUT: memory-only — the six digit cells written into video RAM.
 */
import { expandBcdDigits } from "./expandBcdDigits.js";

const ROW_STEP = 0xffe0; // -0x20: back one tilemap row per digit (draws up a column)
const BYTE_COUNT = 0x0304; // count := 3 source bytes (6 digits); low byte 4 is a dead marker

export function renderBcdColumnFixedCell(m, enteredAt057C = false) {
  const { regs } = m;

  if (!enteredAt057C) {
    regs.ix = 0x7641; // the fixed destination cell, a video-RAM tile cell with no shared name
  }
  regs.exDeHl(); // the source pointer arrives in a register; move it into place, drop what it displaces
  regs.de = ROW_STEP; // per-digit stride: up one tilemap row
  regs.bc = BYTE_COUNT; // 3 source bytes → 6 digits (low byte dead)

  expandBcdDigits(m); // the shared expansion loop: six digits up the column
}
