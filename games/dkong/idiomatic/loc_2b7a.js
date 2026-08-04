// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b7a — snap Mario onto an 8-pixel column and put him there, choosing its route on whether he
 * is moving horizontally through the air.
 *
 * It reads the high byte of Mario's airborne horizontal velocity and his current X, then splits:
 *   - velocity high byte zero    -> pass his current X to the sibling snap arm, which does the
 *                                   snap itself and commits the result.
 *   - velocity high byte nonzero -> do the snap here — (X | 7) - 4, which is (X & ~7) + 3 — and
 *                                   pass the already-snapped X straight to the commit.
 *
 * Both arms end the same way. The commit stores the snapped X as Mario's X and into his sprite
 * record, so the sprite jumps to the new column immediately; it leaves 1 as the result and raises a
 * two-level caller-skip, which this routine passes back unchanged. Since both arms compute the same
 * snapped X and commit it the same way, the whole memory effect is a pure function of Mario's X —
 * the velocity only picks the route, never the outcome.
 *
 * Both destinations take the X in a register rather than as an argument, so it is left there before
 * each call: the raw X for the arm that snaps for itself, the snapped X for the direct commit.
 *
 * LIVE-OUT: Mario's X and his sprite-record X in memory, the result value 1, and the caller-skip
 * boolean.
 */

import { loc_2b8b } from "./loc_2b8b.js";
import { loc_2b91 } from "./loc_2b91.js";
import { MARIO_AIR_VX_HI, MARIO_X } from "./names.js";

/**
 * @param {object} m  the machine.
 * @returns {boolean} false — the caller-skip signal, meaning two levels of caller must be skipped.
 */
export function loc_2b7a(m) {
  const { regs, mem } = m;

  // The route selector: the high byte of Mario's airborne horizontal velocity.
  const velocityHiZero = mem.read8(MARIO_AIR_VX_HI) === 0;

  // Mario's current X, the value both routes snap to its 8-pixel column.
  const marioX = mem.read8(MARIO_X);

  if (velocityHiZero) {
    // Hand the raw X to the sibling arm, which snaps it and commits it.
    regs.a = marioX;
    return loc_2b8b(m);
  }

  // Snap to the 8-pixel column here, then commit the snapped X directly.
  regs.a = (marioX | 0x07) - 4;
  return loc_2b91(m);
}
