// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2079 — retire the object record the movement walk was stepping, then hand the frame on
 *            to the shared object-sprite tail.
 *
 * One exit of the per-frame walk over a ten-record object array. The walk's active-movement
 * branch reaches here after the collision step reports nothing, on one further test it makes:
 * the record's OBJ_X, plus 8, below 16. That window is the eight columns at the left edge
 * (X 0..7) together with the eight that have wrapped past it (X 248..255) — an object within
 * eight pixels of X = 0 either way. Both halves happen in play.
 *
 * It clears two bytes of the record — OBJ_ACTIVE and OBJ_X — and continues into the shared
 * sprite tail, which copies four of the record's fields into the walk's sprite destination and
 * re-enters the walk's loop advance. So the retired record still contributes a sprite this
 * frame, parked at X = 0; it drops out of the walk from the NEXT frame, because the walk's
 * per-slot check admits only records whose OBJ_ACTIVE is set.
 *
 * The reading that this retires an object which has run out of playfield on the left rests on
 * the CALLER's window and on the WALK's per-slot check, not on this routine's own body — the
 * body itself tests nothing and clears the two bytes unconditionally.
 *
 * NOT CLAIMED: what the records of that array hold on the boards where this fires. It has been
 * seen live on two of the array's ten records and nowhere else.
 *
 * LIVE-OUT: memory plus the value the shared tail's chain propagates back. No register and no
 * flag: everything this routine leaves behind is overwritten by the continuation before
 * anything reads it, and the first conditional on that path tests the walk's loop counter
 * rather than a flag.
 */

import { OBJ_ACTIVE, OBJ_X } from "./names.js";

/**
 * @param {object} m  the machine.
 * @param {number} recordBase  the object record to retire, which arrives in the machine's record
 *   pointer. It must equal that pointer: the shared sprite tail re-reads the pointer from the
 *   machine to copy the record's remaining fields, and the walk advances it to the next record.
 * @returns {*} whatever the shared tail's chain returns — undefined on every observed dispatch;
 *   propagated so a skip further down the walk cannot be swallowed here.
 */
export function loc_2079(m, recordBase = m.regs.ix) {
  const { mem8 } = m;

  // Take the record out of the walk, and park it at the left edge for this frame's sprite.
  mem8[recordBase + OBJ_ACTIVE] = 0;
  mem8[recordBase + OBJ_X] = 0;

  // On into the shared object-sprite tail.
  return m.call(0x21ba);
}
