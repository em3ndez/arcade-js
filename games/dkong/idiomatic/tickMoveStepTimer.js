// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickMoveStepTimer — knock MARIO_MOVE_STEP_TIMER down by one, in place; that is the whole job.
 * The shared tail of the walk/climb animation steppers; the expiry decision is made later by
 * reading the timer back. Wraps if it was already zero.
 *
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER, one lower.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";

export function tickMoveStepTimer(m) {
  const { mem8 } = m;
  mem8[MARIO_MOVE_STEP_TIMER] = (mem8[MARIO_MOVE_STEP_TIMER] - 1);
}
