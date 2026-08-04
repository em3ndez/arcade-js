// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbMarioDown — per-frame driver for Mario's DOWNWARD ladder climb.
 *
 * Paces the descent one animation sub-step at a time. Each frame Mario is climbing
 * down, this reads the shared move sub-step pacer (MARIO_MOVE_STEP_TIMER):
 *
 *   - while the pacer is still running (non-zero), it just knocks the pacer down by
 *     one and holds the current climb sub-step this frame;
 *   - the frame the pacer has reached 0, it reloads the pacer to the climb pace
 *     (3 frames) and advances ONE climb sub-step downward — a +2 nudge to Mario's
 *     height — through the shared climb stepper.
 *
 * So the descent advances one sub-step every few frames, its cadence set by the
 * reload value. The upward twin feeds that same shared stepper a −2 step at the
 * walk/climb reload; here the fixed +2 step and the climb reload of 3 are the whole
 * of what makes this the DOWN direction, and they are the only thing that
 * distinguishes the two drivers.
 *
 * LIVE-OUT: memory-only — the pacer here (tick-down or reload), plus whatever the
 * tail callee writes.
 */

import { MARIO_MOVE_STEP_TIMER } from "./names.js";
import { tickMoveStepTimer } from "./tickMoveStepTimer.js";
import { advanceClimbStep } from "./advanceClimbStep.js";

// The climb sub-step cadence: the pacer is reloaded to this once a sub-step advances.
const CLIMB_STEP_PACE = 3;
// Per-frame vertical nudge for a DOWN climb (increases Mario's height / moves him down).
const CLIMB_DOWN_STEP = 2;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function climbMarioDown(m) {
  const { mem } = m;

  // Pacer still running: just tick it down and hold this frame's climb sub-step.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) {
    tickMoveStepTimer(m);
    return;
  }

  // Pacer expired: reload it to the climb pace and advance one sub-step downward.
  mem.write8(MARIO_MOVE_STEP_TIMER, CLIMB_STEP_PACE);
  advanceClimbStep(m, CLIMB_DOWN_STEP); // +2 step = climb down
}
