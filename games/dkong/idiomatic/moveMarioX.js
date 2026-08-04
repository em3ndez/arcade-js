// SPDX-License-Identifier: GPL-3.0-only
/**
 * moveMarioX — advance Mario's X by the current velocity, then hold it inside the horizontal
 * limits.
 *
 * It runs on the moving-platform boards, called from the platform-row mover, which is what picks
 * the row's drift velocity for a Mario riding an elevator or conveyor. The new X is that velocity
 * added to Mario's prior X, and it is stamped into BOTH the live position and the mirror of it
 * kept in the hardware sprite record, so the sprite tracks the move. The horizontal position gate
 * then classifies that new X: run off the far-right edge and the position is nudged one pixel back
 * left; at the far-left or in-band default it is nudged one pixel right; and on a blocked verdict
 * the position stays exactly where the velocity put it. The nudge is applied to the live position
 * ONLY — the sprite-record mirror keeps the pre-nudge X.
 *
 * The velocity and the prior X arrive in registers.
 *
 * LIVE-OUT: memory-only — MARIO_X and MARIO_SPRITE_RECORD.
 */

import { MARIO_X, MARIO_SPRITE_RECORD } from "./names.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js";

/**
 * @param {object} m  the machine. Live-in: regs.a = velocity, regs.b = Mario's prior X.
 * @returns {void}
 */
export function moveMarioX(m) {
  const { regs, mem } = m;

  // New X = current velocity + prior X. Stamp it into the live position and the sprite
  // record's X byte together (the byte store truncates, so this is the 8-bit position).
  const newX = regs.a + regs.b;
  mem.write8(MARIO_X, newX);
  mem.write8(MARIO_SPRITE_RECORD, newX);

  // Classify the new X against the horizontal limits.
  const { d, e } = limitMarioHorizontalTravel(m);

  // Far-right edge -> pull the live position one pixel back left.
  if (e === 1) {
    mem.write8(MARIO_X, mem.read8(MARIO_X) - 1);
    return;
  }

  // Far-left / in-band default -> push the live position one pixel right.
  if (d === 1) {
    mem.write8(MARIO_X, mem.read8(MARIO_X) + 1);
    return;
  }

  // Blocked verdict (0,0) -> leave X exactly where the velocity put it.
}
