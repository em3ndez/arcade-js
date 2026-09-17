// SPDX-License-Identifier: GPL-3.0-only
/**
 * moveMarioX — advance Mario's X by the current velocity, mirror it into the sprite record, then
 * hold the live position inside the horizontal limits (one pixel back-left at the far right, one
 * right at the far left / in-band, unchanged when blocked). The nudge touches the live position
 * only; the sprite-record mirror keeps the pre-nudge X. Velocity and prior X arrive in registers.
 *
 * LIVE-OUT: memory-only — MARIO_X and MARIO_SPRITE_RECORD.
 */

import { MARIO_X, MARIO_SPRITE_RECORD } from "./names.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js";

export function moveMarioX(m, a = m.regs.a, b = m.regs.b) {
  const { mem8 } = m;

  const newX = a + b;
  mem8[MARIO_X] = newX;
  mem8[MARIO_SPRITE_RECORD] = newX;

  const { d, e } = limitMarioHorizontalTravel(m);

  if (e === 1) {
    mem8[MARIO_X] = mem8[MARIO_X] - 1;
    return;
  }

  if (d === 1) {
    mem8[MARIO_X] = mem8[MARIO_X] + 1;
    return;
  }

  // Blocked verdict (0,0) -> leave X exactly where the velocity put it.
}
