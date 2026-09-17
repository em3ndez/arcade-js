// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b4e — store this frame's two ladder-extent limits (first -> A, second -> B; the
 * caller's other branch stores them swapped), then drive the Up-climb. The two cells are a
 * pair the stepper tests together, stopping the climb when Mario's height matches either.
 *
 * LIVE-OUT: memory-only — MARIO_CLIMB_LIMIT_A/B, plus whatever the climb guard writes.
 */

import { MARIO_CLIMB_LIMIT_A, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { climbUpWhileHeld } from "./climbUpWhileHeld.js";

export function loc_1b4e(m) {
  const { regs, mem8 } = m;

  mem8[MARIO_CLIMB_LIMIT_A] = regs.b;
  mem8[MARIO_CLIMB_LIMIT_B] = regs.d;

  climbUpWhileHeld(m);
}
