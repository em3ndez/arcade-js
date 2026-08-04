// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bec — advance the airborne player one frame along his arc, then run the airborne
 *            handler on the result.
 *
 * The two-instruction join point at the bottom of the airborne movement block. Both of that
 * block's horizontal-clamp arms end here, and both arrive with the actor record pointer on
 * Mario's actor record, as every observed dispatch does. The routine steps that record's
 * ballistic state one frame — coordinate A drifts at constant velocity, coordinate B takes
 * its velocity plus the ramping gravity term, and the airborne-frame counter is bumped — and
 * then hands the frame straight to the airborne handler, which decides from the freshly
 * stepped position whether Mario has landed, whether the fall has become lethal, and when to
 * arm the fall-height check.
 *
 * It is reached only when the block above it has just clamped Mario's horizontal drift at a
 * screen edge (or in the upper-left region of an odd-numbered board), so this is the
 * "bounced off the boundary — now finish the frame normally" path rather than the ordinary
 * airborne frame, which reaches the handler directly and never comes through here.
 *
 * Writes no memory of its own: everything it changes is written by the ballistic step (five
 * record bytes) or by the handler it hands off to.
 *
 * LIVE-OUT: memory, plus the handler chain's return value — propagated rather than dropped,
 * so a caller-skip decided further down cannot be swallowed here.
 */

import { stepBallisticMotion } from "./stepBallisticMotion.js";

/**
 * @param {object} m  the machine. The actor record pointer is a live-in the caller sets
 *                    (always Mario's record in every observed dispatch).
 * @returns {*} whatever the airborne handler chain returns — undefined on every observed
 *              dispatch; propagated so a caller-skip further down cannot be swallowed here.
 */
export function loc_1bec(m) {
  // One frame of ballistic motion on the caller's actor record.
  stepBallisticMotion(m);

  // Hand the stepped frame to the airborne handler.
  return m.call(0x1c05);
}
