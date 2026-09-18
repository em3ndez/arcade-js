// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickObjectDwellThenTransition — tick a per-object dwell countdown, blink the sprite while it
 * runs, and hand off to the round/mode transition when it expires. Reaching zero ends the wait
 * (control passes to the transition, whose return unwinds to our caller); otherwise every fourth
 * tick flips the shared vertical-flip bit of the actor-state flag and the sprite code to blink the
 * actor. Which game event the expiry gates is still open, so the name stays neutral.
 */

import { ENEMY_ACTION_TIMER, ENEMY_WORK_SPRITE, PLAYER_FACING } from "./names.js";
import { dockManAndDispatchRoundBoundary } from "./dockManAndDispatchRoundBoundary.js";

export function tickObjectDwellThenTransition(m) {
  const { mem8 } = m;

  // Knock one off the countdown (the byte store wraps 0 back round to 255).
  const remaining = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = remaining;

  // Reaching zero ends the wait as a mid-frame warm restart: abandon this frame and swap the
  // whole main generator (m.restartMain throws RESTART, caught by runIdiomaticGame).
  if (remaining === 0) return m.restartMain(() => dockManAndDispatchRoundBoundary(m));

  // Otherwise act only on every fourth tick; all other ticks just let the timer run.
  if ((remaining & 3) !== 0) return;

  // Flip the shared top (flip / frame-select) bit of the actor-state flag and the sprite code.
  mem8[ENEMY_WORK_SPRITE] ^= 0x80;
  mem8[PLAYER_FACING] ^= 0x80;
}
