// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbMarioUp — per-frame driver for Mario's upward ladder climb, paced by MARIO_MOVE_STEP_TIMER.
 * While the timer runs, hold between sub-steps; when it expires, reload it and advance one climb
 * step UP (a −2 step to the shared stepper; the climb-DOWN driver uses +2).
 *
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER, plus whatever the chosen callee writes.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";
import { loc_1d76 } from "./loc_1d76.js";
import { advanceClimbStep } from "./advanceClimbStep.js";

const CLIMB_UP_STEP = -2;
const MOVE_STEP_FRAMES = 4;

export function climbMarioUp(m) {
  const { mem8 } = m;

  if (mem8[MARIO_MOVE_STEP_TIMER] !== 0) {
    loc_1d76(m);
    return;
  }

  mem8[MARIO_MOVE_STEP_TIMER] = MOVE_STEP_FRAMES;
  advanceClimbStep(m, CLIMB_UP_STEP);
}
