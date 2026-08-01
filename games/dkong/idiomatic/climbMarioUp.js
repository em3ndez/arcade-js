// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbMarioUp — drive Mario's upward climb one animation step per frame, paced by
 * the move-step timer.  ROM 0x1D03.
 *
 * The climb-UP driver (its mirror-image twin loc_1cf2 at ROM 0x1CF2 is the climb-DOWN
 * driver). Called once per frame while Mario is holding UP on a ladder. It paces the
 * climb with MARIO_MOVE_STEP_TIMER so the animation advances every few frames rather
 * than every frame:
 *   - While the timer is still running (non-zero), it hands off to loc_1d76, which
 *     decides whether to tick the timer down this frame — holding Mario between
 *     animation sub-steps without moving him.
 *   - When the timer has expired, it reloads it to 4 and advances the climb one step
 *     UP: the shared climb stepper (advanceClimbStep) is invoked with a step of −2, so
 *     Mario's height decreases by two (moving up the screen) and the next climb sprite
 *     / ladder-end handling is committed.
 *
 * NAME (promoted): advanceClimbStep (ROM 0x1D11, the confirmed shared climb stepper)
 * documents its two callers — this one and loc_1cf2, step −2 / +2 — as climb-up /
 * climb-down; the −2 step this routine feeds it (Mario's height decreasing = moving up
 * the screen) corroborates the climb-up role, and the only cell it touches itself is
 * the move-step timer that paces the animation.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d03.test.js.
 * GATE:     real captured 0x1D03 dispatches (attract climbs ladders, so both arms fire
 *           naturally) + a full 256-value sweep of MARIO_MOVE_STEP_TIMER on a real base
 *           that pins the exact timer branch and the climb-step arm. Both callees
 *           (loc_1d76, advanceClimbStep) are already idiomatic and direct-called, so this
 *           also composes their own equivalence. Teeth: inverted branch, wrong reload,
 *           and a climb-DOWN (+2) step twin.
 * LIVE-OUT: memory-only — MARIO_MOVE_STEP_TIMER here, plus whatever the chosen callee
 *           writes. The single caller (loc_1b45) tail-jumps into this and consumes no
 *           register it leaves. The chain nets exactly one caller-return.
 * NAMES:    MARIO_MOVE_STEP_TIMER (0x620F) from ram.js. Delegates to the already-idiomatic
 *           loc_1d76 (ROM 0x1D76) and advanceClimbStep (ROM 0x1D11); the unnamed cells
 *           those touch are documented in their own headers, not touched here.
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js";
import { loc_1d76 } from "./loc_1d76.js";                 // ROM 0x1D76
import { advanceClimbStep } from "./advanceClimbStep.js"; // ROM 0x1D11

// Climb-UP step handed to the shared climb stepper: Mario's height drops by 2 each
// animation sub-step (lower Y = higher on screen). The twin climb-DOWN driver uses +2.
const CLIMB_UP_STEP = -2;

// Frames between climb-animation sub-steps; reloaded each time the timer expires.
const MOVE_STEP_FRAMES = 4;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function climbMarioUp(m) {
  const { mem } = m;

  // Still mid-hold between animation sub-steps: let loc_1d76 decide whether to tick the
  // move-step timer down this frame; do not advance the climb yet.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) {
    loc_1d76(m); // ROM 0x1D76
    return;
  }

  // Timer expired: restart the cadence and advance one climb step UP.
  mem.write8(MARIO_MOVE_STEP_TIMER, MOVE_STEP_FRAMES);
  advanceClimbStep(m, CLIMB_UP_STEP); // ROM 0x1D11
}
