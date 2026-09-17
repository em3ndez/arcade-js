// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginMarioFall — when the start-fall trigger is armed, drop Mario into a fresh falling
 * state and remember the height he fell from.
 *
 * Does nothing unless MARIO_START_FALL is set. When it is, the one-shot trigger is
 * consumed and Mario's motion state is rebuilt for a fall from rest: sub-pixel remainders
 * and airborne velocity/frame state cleared, airborne and landing-check flags set, and his
 * current Y snapshotted as the take-off height the landing code measures against.
 *
 * LIVE-OUT: memory-only.
 */

import {
  MARIO_START_FALL,
  MARIO_X_FRAC,
  MARIO_Y_FRAC,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
  MARIO_AIRBORNE,
  MARIO_AIR_LANDCHECK,
  MARIO_Y,
  MARIO_AIR_START_Y,
} from "./names.js";

export function beginMarioFall(m) {
  const { mem8 } = m;

  if (mem8[MARIO_START_FALL] === 0) return;

  mem8[MARIO_X_FRAC] = 0;
  mem8[MARIO_Y_FRAC] = 0;
  mem8[MARIO_START_FALL] = 0;
  mem8[MARIO_AIR_VX_HI] = 0;
  mem8[MARIO_AIR_VX_LO] = 0;
  mem8[MARIO_AIR_VY_HI] = 0;
  mem8[MARIO_AIR_VY_LO] = 0;
  mem8[MARIO_AIR_FRAMES] = 0;

  mem8[MARIO_AIRBORNE] = 1;
  mem8[MARIO_AIR_LANDCHECK] = 1;

  mem8[MARIO_AIR_START_Y] = mem8[MARIO_Y];
}
