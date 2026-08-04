// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioDownWithLift — carry Mario one pixel DOWN the screen while he rides a descending
 * lift, or kill him once he reaches the bottom of his OWN run.
 *
 * On the lift board, lifts run in two columns: one rising, one descending. This is the arm the
 * ride handler picks while Mario stands in the descending column. MARIO_Y is the sole input —
 * the branch and every write follow from it and nothing else:
 *
 *   - still above the bottom-of-run row: his Y is advanced by one, which is a single pixel DOWN
 *     the screen since a larger Y is lower, and the new value is mirrored into the Y field of
 *     his sprite record so the drawn sprite tracks the move.
 *   - at or past that row: his run is over and control passes to the kill, which clears the
 *     flag that keeps Mario active — he dies, the death animation runs and a life is lost.
 *
 * THE LIMIT IS AN ABSOLUTE SCREEN ROW FOR MARIO, NOT THE LIFT'S END OF TRAVEL. No object record
 * is read here at all; the comparison is against Mario's own Y and nothing else. A rider sits
 * about 11-12 pixels above the platform he stands on, and the descending lift itself keeps going
 * a few pixels past the row that kills him before it deactivates. The two ends of travel are
 * close together but they are different tests, and it is Mario's row that decides this one.
 *
 * A rider is not enclosed in anything. The lift is an exposed vertical rail with a riveted drive
 * housing at its head and foot, and the platform Mario stands on is an X-braced truss: no shaft,
 * no car, no doors — which is why this reads as a lift's run rather than a lift's shaft.
 *
 * A NEAR-LEAF: it reads Mario's Y, writes Mario's Y and his sprite-record Y, and on the
 * end-of-run arm calls the kill. It returns nothing a caller consumes.
 *
 * LIVE-OUT: memory-only — Mario's Y and his sprite-record Y on the step arm; on the end-of-run
 * arm, the cells the kill clears.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./names.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";

// Mario's sprite-record Y field: the position byte the display reads for him.
// The carry mirrors MARIO_Y here so the sprite follows the move.
const MARIO_SPRITE_Y = MARIO_SPRITE_RECORD + SPRITE_Y;

// The bottom of Mario's own run, as an absolute screen row (larger Y is lower on screen).
// His Y advances up to, but never past, this value; at the limit the carry hands off to the
// kill instead of moving. Nothing here consults the lift, which runs 4-5 px further down.
const Y_LIMIT = 232;

/**
 * @param {object} m  the machine (memory only; the kill runs at the bottom of the run).
 * @returns {void}
 */
export function carryMarioDownWithLift(m) {
  const { mem } = m;

  const y = mem.read8(MARIO_Y);

  // At or past the bottom of his run: stop moving and kill Mario.
  if (y >= Y_LIMIT) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  // Otherwise step him one pixel down the screen and mirror the new Y to the sprite.
  const next = y + 1;
  mem.write8(MARIO_Y, next);
  mem.write8(MARIO_SPRITE_Y, next);
}
