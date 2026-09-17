// SPDX-License-Identifier: GPL-3.0-only
/**
 * marioReachedTargetColumn — three-condition hit test for the 50m object state machine: Mario
 * has reached the target when MARIO_Y is above REACH_Y (grounded rows), MARIO_AIRBORNE is
 * clear, and MARIO_X equals the object's target X (the byte the caller points at via regs.hl).
 * A hit returns true; any miss hands off to the shared no-hit tail, which returns false and
 * skips the caller.
 *
 * LIVE-OUT: the boolean hit signal (true = hit, false = no-hit skip); memory is untouched.
 */

import { MARIO_X, MARIO_Y, MARIO_AIRBORNE } from "./names.js";
import { reportNoHitAndSkipCaller } from "./reportNoHitAndSkipCaller.js";

// Larger Y is LOWER on screen, so the reach band is the rows ABOVE this one.
const REACH_Y = 122;

export function marioReachedTargetColumn(m, hl = m.regs.hl) {
  const { mem8 } = m;

  if (mem8[MARIO_Y] >= REACH_Y) return reportNoHitAndSkipCaller(m);
  if (mem8[MARIO_AIRBORNE] !== 0) return reportNoHitAndSkipCaller(m);
  if (mem8[MARIO_X] !== mem8[hl]) return reportNoHitAndSkipCaller(m);

  return true;
}
