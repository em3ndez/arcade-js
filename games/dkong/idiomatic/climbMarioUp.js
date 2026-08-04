// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbMarioUp — drive Mario's upward climb one animation step per frame, paced by
 * the move-step timer.
 *
 * Runs once a frame while Mario is holding UP on a ladder, and paces the climb with
 * MARIO_MOVE_STEP_TIMER so the animation advances every few frames rather than every
 * frame:
 *   - While the timer is still running, it hands off to the hold step, which decides
 *     whether to tick the timer down this frame — holding Mario between animation
 *     sub-steps without moving him.
 *   - When the timer has expired, it reloads the timer and advances the climb one step
 *     UP: the shared climb stepper is handed a step of −2, so Mario's Y decreases by
 *     two — two pixels UP the screen — and the next climb sprite and the ladder-end
 *     handling are committed.
 *
 * The −2 is what makes this the climb-UP driver; the mirror-image climb-DOWN driver
 * hands the same stepper +2.
 *
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER here, plus whatever the chosen callee
 * writes. Nothing reads a value back from this routine.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";
import { loc_1d76 } from "./loc_1d76.js";
import { advanceClimbStep } from "./advanceClimbStep.js";

// Climb-UP step handed to the shared climb stepper: Mario's Y drops by 2 each
// animation sub-step (lower Y = higher on screen). The climb-DOWN driver uses +2.
const CLIMB_UP_STEP = -2;

// Frames between climb-animation sub-steps; reloaded each time the timer expires.
const MOVE_STEP_FRAMES = 4;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function climbMarioUp(m) {
  const { mem } = m;

  // Still mid-hold between animation sub-steps: let the hold step decide whether to
  // tick the move-step timer down this frame; do not advance the climb yet.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) {
    loc_1d76(m);
    return;
  }

  // Timer expired: restart the cadence and advance one climb step UP.
  mem.write8(MARIO_MOVE_STEP_TIMER, MOVE_STEP_FRAMES);
  advanceClimbStep(m, CLIMB_UP_STEP);
}
