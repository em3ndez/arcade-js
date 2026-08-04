// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b4e — commit this frame's ladder-extent limits, then drive the Up-climb.
 *
 * The "collision cleared, keep climbing" tail of the hammer-climb collision handler. Its caller has
 * just computed the two ladder-extent limits for the current climb — one from Mario's current
 * height, one from the girder scan — hands them in through registers, and branches here. This
 * routine stores that pair into the two climb-limit cells the climb stepper later compares Mario
 * against, and falls straight into the Up-climb input guard.
 *
 * The caller's OTHER branch stores the SAME pair into the SAME two cells in the OPPOSITE order, so
 * which limit is "top" and which is "bottom" is not fixed by this routine: the two are a pair the
 * stepper tests together, stopping the climb when the new height matches EITHER. This branch stores
 * the first-given limit into MARIO_CLIMB_LIMIT_A and the second into MARIO_CLIMB_LIMIT_B.
 *
 * Having committed the pair it hands off to the Up-climb guard, which advances Mario's climb this
 * frame only while Up is held. This routine writes no further memory of its own.
 *
 * WHY THE NAME IS STILL AN ADDRESS. The mechanism — store the limit pair, then climb — is pinned by
 * the body, but the two cells' top/bottom roles are genuinely unsettled, and any English name for
 * this routine would have to assert one of them.
 *
 * Reads: the two limit values, from registers. Writes: MARIO_CLIMB_LIMIT_A and
 * MARIO_CLIMB_LIMIT_B, plus whatever the climb guard writes on the Up arm.
 * LIVE-OUT: memory-only. The caller consumes no register this leaves.
 */

import { MARIO_CLIMB_LIMIT_A, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { climbUpWhileHeld } from "./climbUpWhileHeld.js";

/**
 * @param {object} m  the machine. The two ladder-extent limits arrive in the caller's
 *                    registers; otherwise this touches only m.mem.
 * @returns {void}
 */
export function loc_1b4e(m) {
  const { regs, mem } = m;

  // Store the two ladder-extent limits the caller computed for this climb. This branch takes
  // them in the order (first -> A, second -> B); the caller's other branch stores them swapped.
  mem.write8(MARIO_CLIMB_LIMIT_A, regs.b);
  mem.write8(MARIO_CLIMB_LIMIT_B, regs.d);

  // Keep climbing: advance Mario's upward climb this frame if Up is held.
  climbUpWhileHeld(m);
}
