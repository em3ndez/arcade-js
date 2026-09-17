// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchMarioMovement — the movement machine's router: pick which handler owns Mario's frame.
 *
 * Five tests in a fixed priority order, and the ORDER IS THE MECHANIC — the first that fires takes
 * the frame, nothing below it is consulted:
 *
 *   1. MARIO_AIRBORNE set -> airborne-frame handler (a jump/fall owns the whole frame).
 *   2. MARIO_FREEZE_TIMER nonzero -> post-landing freeze tick.
 *   3. MARIO_HAMMER_ACTIVE set -> ground walk. Entering ABOVE the ladder and jump tests is why a
 *      held hammer makes both unreachable — that is the hammer's cost.
 *   4. MARIO_ON_LADDER set -> climb dispatch.
 *   5. jump press-edge bit of P1_INPUT -> jump launcher.
 *   6. otherwise -> ground walk (ordinary walking / stepping onto a ladder).
 *
 * LIVE-OUT: memory-only. Writes nothing itself; every visible byte belongs to the handler it picked.
 */

import {
  MARIO_AIRBORNE,
  MARIO_FREEZE_TIMER,
  MARIO_HAMMER_ACTIVE,
  MARIO_ON_LADDER,
  P1_INPUT,
} from "./names.js";
import { advanceMarioAirborneFrame } from "./advanceMarioAirborneFrame.js";
import { tickPostLandingFreeze } from "./tickPostLandingFreeze.js";
import { walkRightWhileHeld } from "./walkRightWhileHeld.js";
import { climbDownWhileHeld } from "./climbDownWhileHeld.js";
import { initMarioJump } from "./initMarioJump.js";

// Top bit of the cooked control word: set for exactly one frame per fresh jump-button press.
const JUMP_PRESS_EDGE = 0x80;

export function dispatchMarioMovement(m) {
  const { mem8 } = m;

  if (mem8[MARIO_AIRBORNE] === 1) return advanceMarioAirborneFrame(m);
  if (mem8[MARIO_FREEZE_TIMER] !== 0) return tickPostLandingFreeze(m);
  if (mem8[MARIO_HAMMER_ACTIVE] === 1) return walkRightWhileHeld(m);
  if (mem8[MARIO_ON_LADDER] === 1) return climbDownWhileHeld(m);
  if (mem8[P1_INPUT] & JUMP_PRESS_EDGE) return initMarioJump(m);
  return walkRightWhileHeld(m);
}
