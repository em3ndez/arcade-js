// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchMarioMovement — the movement machine's router: pick which handler owns Mario's frame.
 *
 * Run once per frame from the shared per-frame update cascade. It writes no memory of its
 * own — it is five tests in a fixed priority order, and the ORDER IS THE MECHANIC. The
 * first test that fires takes the frame; nothing below it is consulted:
 *
 *   1. MARIO_AIRBORNE set -> the airborne-frame handler. A jump or a fall owns the whole
 *      frame: the arc is integrated and steered, and no input below is looked at, which is
 *      why a jump cannot be steered onto a ladder or re-triggered in mid-air.
 *   2. MARIO_FREEZE_TIMER nonzero -> the post-landing freeze tick. The few frames after a
 *      landing, in which Mario is unresponsive and the timer just counts down.
 *   3. MARIO_HAMMER_ACTIVE set -> the ground walk handler. Note WHERE this enters: ABOVE
 *      the ladder test and above the jump test, so a held hammer claims the frame before
 *      either of those is reached — the climb branch and the jump branch are both
 *      unreachable while the hammer is up, and that is exactly the hammer's cost.
 *   4. MARIO_ON_LADDER set -> the climb dispatch, the Down/Up half of the movement machine.
 *   5. the jump press-edge bit of P1_INPUT -> the jump launcher, which flags Mario airborne
 *      and starts the arc — so from the NEXT frame test 1 takes over.
 *   6. otherwise fall through to the ground walk handler: ordinary grounded walking, and
 *      stepping onto a ladder, which is what sets the flag test 4 reads on later frames.
 *
 * Every test is exact rather than a range: the three flag tests fire on the value 1 alone
 * (2 or 128 in MARIO_AIRBORNE would fall through to the freeze test), the freeze test fires
 * on any nonzero, and the jump test looks at the input word's top bit only.
 *
 * LIVE-OUT: memory-only. This routine writes nothing itself; every visible byte belongs to
 * the handler it picked. Whatever the handler returns is passed along and then discarded —
 * the per-frame cascade calls its next routine without reading anything back.
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

/**
 * @param {object} m  the machine (reads memory only; writes nothing of its own).
 * @returns {*} whatever the selected handler returns — dead; the caller discards it.
 */
export function dispatchMarioMovement(m) {
  const { mem } = m;

  // Airborne outranks everything: a jump or fall owns the frame, input included.
  if (mem.read8(MARIO_AIRBORNE) === 1) return advanceMarioAirborneFrame(m);

  // Still frozen from the last landing — tick it down and do nothing else.
  if (mem.read8(MARIO_FREEZE_TIMER) !== 0) return tickPostLandingFreeze(m);

  // Hammer in hand: walking only. Entering the ground arm here skips both the ladder
  // branch and the jump branch below.
  if (mem.read8(MARIO_HAMMER_ACTIVE) === 1) return walkRightWhileHeld(m);

  // On a ladder: the climb dispatch owns the frame.
  if (mem.read8(MARIO_ON_LADDER) === 1) return climbDownWhileHeld(m);

  // A fresh jump press this frame: launch the arc.
  if (mem.read8(P1_INPUT) & JUMP_PRESS_EDGE) return initMarioJump(m);

  // Grounded and not jumping: ordinary walking / stepping onto a ladder.
  return walkRightWhileHeld(m);
}
