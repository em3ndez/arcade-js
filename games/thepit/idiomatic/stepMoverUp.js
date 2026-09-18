// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverUp — commit one preset move-step for the tracked mover: step its vertical position up a pixel, and on the movement cadence republish its travel direction.
 *
 * The per-object move driver settles on where the mover should go, then tail-jumps into
 * one of four near-identical preset entry points; this is the "direction 0" preset, so its
 * return goes to the driver's caller. Every call decrements the vertical position by a pixel
 * (moving it up, wrapping in a byte); the cadence countdown is ticked, and only when it hits
 * zero does the object re-commit — reload the countdown and re-stamp the direction index to 0.
 * This preset carries no orientation flag, so it never touches the sprite code.
 */

import { ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD, ENEMY_WORK_Y } from "./names.js";

export function stepMoverUp(m) {
  const { mem8 } = m;

  // Tick the movement-cadence countdown (stored back; 0 becomes 255 on wrap).
  const cadence = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = cadence;

  // On expiry, re-commit: reload the countdown and re-stamp the direction index to 0.
  if (cadence === 0) {
    mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD];
    mem8[ENEMY_WORK_DIR] = 0;
  }

  // Step the object up one pixel every frame by decrementing its vertical position.
  mem8[ENEMY_WORK_Y] = mem8[ENEMY_WORK_Y] - 1;
}
