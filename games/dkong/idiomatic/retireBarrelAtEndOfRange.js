// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireBarrelAtEndOfRange — retire a barrel record once its X has run down to the bottom of its
 * travel range; otherwise hand the record on unchanged.
 *
 * Reads the record's OBJ_X. Writes, on the retire arm only, OBJ_ACTIVE and OBJ_X, both zeroed.
 * Nothing else in the record is touched.
 *
 * The test is on X + WRAP_MARGIN taken at eight-bit width, not on X, so an X that has run down PAST
 * zero and wrapped to the top of the byte counts as retired just as a small positive X does. That
 * wrap is the one genuinely load-bearing width artifact here: without it a barrel whose X has gone
 * negative would be handed on as if it were at the far end of the range.
 *
 * Both exits are hand-offs, not returns — control leaves this routine for good and the value the
 * hand-off produces is forwarded straight back to this routine's caller:
 *   above the limit -> the tile-animation step, which then joins the shared object-sprite tail;
 *   at or below     -> that same shared tail, entered directly.
 * Either way the record's four sprite fields are gathered and the caller's sweep continues, so a
 * retired record is still published this frame — with the zeroed X this routine just wrote.
 *
 * WHAT THIS DOES IN THE GAME. OBJ_ACTIVE is the object-record array's own "is this slot live" flag,
 * so zeroing it frees the slot; the accompanying zero of OBJ_X is what stops the freed slot from
 * being drawn where it died.
 *
 * NOT CLAIMED: which physical screen edge X = 0 is, and why the margin is 8 rather than some other
 * value, were not derived.
 *
 * The record base arrives in the index register and is deliberately NOT a parameter: both hand-off
 * targets read the record straight off that register, so a caller passing a different base would be
 * obeyed by these three lines and ignored one hand-off later.
 *
 * LIVE-OUT: the two record fields, and the value the hand-off returns — this routine forwards it
 * and adds nothing of its own.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_ACTIVE, OBJ_X } from "./names.js";

/** X strictly below this, after the wrap-tolerant shift, retires the record. */
const X_LIMIT = 16;
/** How far past zero an X may already have wrapped and still count as at the limit. */
const WRAP_MARGIN = 8;

/**
 * @param {object} m  the machine; the record base is read from its index register.
 * @returns {*} whatever the hand-off target returns, forwarded unchanged.
 */
export function retireBarrelAtEndOfRange(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  if (u8(mem8[record + OBJ_X] + WRAP_MARGIN) >= X_LIMIT) return m.call(0x1fce);

  mem8[record + OBJ_ACTIVE] = 0;
  mem8[record + OBJ_X] = 0;
  return m.call(0x21ba);
}
