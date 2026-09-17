// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbMarioDown — per-frame driver for Mario's downward ladder climb, paced by
 * MARIO_MOVE_STEP_TIMER. While the pacer runs, hold this sub-step; when it reaches 0, reload it to
 * the climb pace (3) and advance one sub-step downward (a +2 step to the shared stepper; the upward
 * twin uses −2).
 *
 * LIVE-OUT: memory-only — the pacer, plus whatever the tail callee writes.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";
import { tickMoveStepTimer } from "./tickMoveStepTimer.js";
import { advanceClimbStep } from "./advanceClimbStep.js";

const CLIMB_STEP_PACE = 3;
const CLIMB_DOWN_STEP = 2;

export function climbMarioDown(m) {
  const { mem8 } = m;

  if (mem8[MARIO_MOVE_STEP_TIMER] !== 0) {
    tickMoveStepTimer(m);
    return;
  }

  mem8[MARIO_MOVE_STEP_TIMER] = CLIMB_STEP_PACE;
  advanceClimbStep(m, CLIMB_DOWN_STEP);
}
