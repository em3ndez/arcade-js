// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchElevatorRideByColumn — while Mario is standing on an elevator, route him to the
 * up-column or the down-column carry by his X position.
 *
 * On the elevator board the lifts run in two columns, one rising and one descending. This
 * runs only when Mario is aboard a lift and grounded; two guards drop the whole routine
 * otherwise:
 *   - the "standing on a lift" flag is clear — he is not aboard this frame, so it returns;
 *   - Mario is airborne — busy in the air, so the carry is left for a grounded frame.
 *
 * With both guards open it reads Mario's X and routes by band, one band per lift column:
 * the lower band is the RISING column and carries Mario UP, the higher band is the
 * DESCENDING column and carries him DOWN. Each carry steps his Y one pixel with the lift
 * and mirrors that to his sprite record, and each hands off to a check that KILLS Mario —
 * clearing his active flag, which is a kill rather than an end-of-travel reset — once his Y
 * crosses that column's own fixed row limit. Those limits are absolute rows, read without
 * reference to where the lift itself has got to.
 *
 * Every X outside both bands takes a third arm. Nothing is written here directly; every
 * effect belongs to the dispatched arm.
 *
 * WHY THE BANDS ARE THE COLUMNS: a lift is spawned at X 55, dead centre of the lower band,
 * and is teleported to X 119, dead centre of the higher one, the instant it finishes rising.
 * Those two X values are exactly what every lift on a live board holds, so each band
 * brackets one column and nothing else.
 *
 * WHY THE FLAG MEANS "STANDING ON A LIFT": it has exactly one setter, in the land-on-a-lift
 * arm, which three instructions earlier sets Mario's Y to the lift's own Y minus twelve.
 * During play the gap between the lift's Y and Mario's Y stays pinned at eleven or twelve
 * with no drift at all, so the flag and the standing position agree.
 *
 * NOT OBSERVED: the third arm. It recorded zero executions in every grounding run, so no
 * claim is made here about what taking it means.
 *
 * Reads: the standing-on-a-lift flag; Mario's airborne flag; Mario's X. Writes: nothing of
 * its own.
 *
 * LIVE-OUT: memory-only — whatever the dispatched arm writes. The caller consumes no result.
 */

import { EDGE_REPOSITION_FLAG, MARIO_AIRBORNE, MARIO_X } from "./names.js";
import { loc_2766 } from "./loc_2766.js";
import { carryMarioUpWithLift } from "./carryMarioUpWithLift.js";
import { carryMarioDownWithLift } from "./carryMarioDownWithLift.js";

// Mario's X picks the lift column he is riding — one band per column. Lifts spawn at X 55
// in the first and are teleported to X 119 in the second, so each band brackets one column.
// Every X outside both takes the third arm.
const MOVER_276F_BAND_LO = 44;   // [44, 67)   -> rising column, carry Mario UP
const MOVER_276F_BAND_HI = 67;
const MOVER_2787_BAND_LO = 108;  // [108, 131) -> descending column, carry him DOWN
const MOVER_2787_BAND_HI = 131;

/**
 * @param {object} m  the machine (uses m.mem; dispatches into one of the three arms).
 * @returns {void}
 */
export function dispatchElevatorRideByColumn(m) {
  const { mem } = m;

  // Inactive unless Mario is standing on a lift.
  if (mem.read8(EDGE_REPOSITION_FLAG) === 0) return;

  // Busy while airborne — leave the carry for a grounded frame.
  if (mem.read8(MARIO_AIRBORNE) !== 0) return;

  // Dispatch by X band, tested as an ascending cascade.
  const x = mem.read8(MARIO_X);
  if (x < MOVER_276F_BAND_LO) { loc_2766(m); return; } // left of the rising column
  if (x < MOVER_276F_BAND_HI) { carryMarioUpWithLift(m); return; } // the rising column
  if (x < MOVER_2787_BAND_LO) { loc_2766(m); return; } // between the two columns
  if (x < MOVER_2787_BAND_HI) { carryMarioDownWithLift(m); return; } // the descending column
  loc_2766(m);                                          // right of the descending column
}
