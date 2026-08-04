// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioUpWithLift — carry Mario one pixel UP the screen while he rides a rising lift, or kill
 * him once he has been carried to the top of his OWN run.
 *
 * This is the rising-column arm of the lift ride, and it looks only at how far up Mario has got:
 *
 *   - Once his Y has come up past the limit row — smaller Y is higher on this screen — it hands off
 *     to the kill, which clears Mario's active flag. He dies, the death animation runs, and a life
 *     is lost.
 *   - Otherwise it takes one off his Y, moving him a single pixel up, and mirrors the new value
 *     into the Y field of his hardware sprite record so the sprite follows the same frame.
 *
 * THE LIMIT IS AN ABSOLUTE ROW OF MARIO'S, NOT THE LIFT'S END OF TRAVEL. This routine never reads
 * an object record; the only comparison it makes is Mario's Y against a constant. He rides a fixed
 * eleven or twelve pixels above the platform he is standing on, so he crosses the limit row while
 * the platform still has climb left, and it carries on past him after he dies. "End of lift travel"
 * is the lift-relative reading of the same test, and it is loose by that much on this arm.
 *
 * LIVE-OUT: memory-only — on the step arm, Mario's Y and his sprite-record Y; on the hand-off arm,
 * whatever the kill writes.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./names.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js";

// A Y below this means Mario has been carried up to the top of his run, which ends the ride.
// It is an absolute row of his own: nothing here consults the lift.
const TOP_LIMIT = 0x71;

/**
 * @param {object} m  the machine; memory only.
 * @returns {void}
 */
export function carryMarioUpWithLift(m) {
  const { mem } = m;

  const y = mem.read8(MARIO_Y);

  // Carried to the top of his run — kill Mario and clear the on-a-lift flag.
  if (y < TOP_LIMIT) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  // Still travelling — step one pixel up and mirror the new Y to the sprite record so the
  // on-screen sprite tracks it. The value only lands in byte stores (which truncate), and
  // y >= 0x71 means y - 1 never goes negative, so no wrap is needed here.
  const stepped = y - 1;
  mem.write8(MARIO_Y, stepped);
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_Y, stepped);
}
