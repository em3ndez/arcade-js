// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickMoveStepTimer — count down the pacer that decides how long Mario holds each frame of his
 * walking and climbing animation.
 *
 * The shared tail of the walk and climb animation steppers. It knocks MARIO_MOVE_STEP_TIMER down
 * by one and that is all it does. While the timer is above zero the mover keeps showing its
 * current animation sub-step; on the frame it reaches zero the stepper reloads it and moves on to
 * the next sub-step, which is what paces Mario's stride and his climb.
 *
 * The countdown is the whole job. Nothing here reloads the timer and nothing here branches on the
 * result — the expiry decision is made later, by reading the timer back, not by anything this
 * routine hands over.
 *
 * A LEAF: it reads and writes one cell and calls nothing.
 *
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER, one lower. It wraps if it was already zero.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function tickMoveStepTimer(m) {
  const { mem } = m;
  // Count the walk/climb sub-step pacer down one, in place.
  mem.write8(MARIO_MOVE_STEP_TIMER, (mem.read8(MARIO_MOVE_STEP_TIMER) - 1) & 0xff);
}
