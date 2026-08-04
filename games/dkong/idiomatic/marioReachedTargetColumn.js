// SPDX-License-Identifier: GPL-3.0-only
/**
 * marioReachedTargetColumn — has Mario reached the target position? a three-condition
 * hit test.
 *
 * Called from the 50m object state machine, whose parked and sliding arms each point
 * at one byte of an object record — the object's target X — and ask whether Mario has
 * arrived there. Three conditions must all hold for a HIT:
 *
 *   1. MARIO_Y is numerically under REACH_Y — larger Y is LOWER on screen, so the reach
 *      band is the rows ABOVE that one; at that row or anywhere lower down the screen
 *      the hit never registers.
 *   2. MARIO_AIRBORNE is clear — the hit only counts with Mario grounded, not mid jump
 *      or fall.
 *   3. MARIO_X exactly equals the object's target X (the byte the caller points at).
 *
 * On a HIT the routine reports true and the caller runs its own tail (which stamps its
 * follow-up state). On any miss it hands off to the shared no-hit tail, whose result is
 * false, so the caller propagates the skip and its tail never runs. The false result
 * therefore unwinds two levels up.
 *
 * A near-LEAF: it reads three Mario cells plus the caller's target byte, writes no
 * memory, and hands off only to the no-hit tail. Its input is the target pointer the
 * caller leaves in the register pair.
 *
 * A pure predicate over Mario's position and airborne state: it claims no game purpose
 * beyond the hit test itself.
 *
 * LIVE-OUT: the boolean hit signal (true = hit, false = no-hit skip); memory is
 * untouched.
 */

import { MARIO_X, MARIO_Y, MARIO_AIRBORNE } from "./names.js";
import { reportNoHitAndSkipCaller } from "./reportNoHitAndSkipCaller.js"; // the shared no-hit caller-skip tail

// Mario's Y must be numerically under this for the hit to register. Larger Y is LOWER on
// screen, so the reach band is the rows ABOVE this one; at this row or anywhere lower on
// screen the object is out of reach and the test always misses.
const REACH_Y = 122;

/**
 * @param {object} m  the machine. The caller leaves the target-X pointer in the
 *   register pair.
 * @returns {boolean} true on a hit (caller continues); false on a miss (caller skips).
 */
export function marioReachedTargetColumn(m) {
  const { regs, mem } = m;

  // Out of the reach band — at this row or lower on screen (larger Y is LOWER), so too far
  // DOWN the playfield to count.
  if (mem.read8(MARIO_Y) >= REACH_Y) return reportNoHitAndSkipCaller(m);

  // Airborne — the hit only registers with Mario grounded.
  if (mem.read8(MARIO_AIRBORNE) !== 0) return reportNoHitAndSkipCaller(m);

  // Horizontally aligned with the object's target X?
  if (mem.read8(MARIO_X) !== mem.read8(regs.hl)) return reportNoHitAndSkipCaller(m);

  // All three conditions met — HIT: the caller runs its own tail.
  return true;
}
