// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickObjectDwellThenTransition — tick a per-object state countdown; blink its sprite while it runs and
 * hand off to the round/mode transition when it expires.  ROM 0x3458.
 *
 * Each call knocks one off the countdown cell 0x808b (used here as a per-object dwell
 * timer, not as a random draw). Three outcomes:
 *   - The tick that brings the countdown to zero ends the wait: control passes to the
 *     game mode/round transition, whose own return unwinds past this routine to our
 *     caller (a tail transfer).
 *   - While the countdown is still running the routine acts only on every fourth tick,
 *     flipping the top bit of the actor-state flag and of the sprite code together.
 *     That top bit is the sprite's vertical-flip / frame-select bit, so the paired flip
 *     drives a steady two-frame blink of the actor as it waits the timer out.
 *   - Any other tick does nothing further.
 *
 * Reached only from the per-object move driver (stepEnemyMover), as its "arrived / caught"
 * state: once whenever the object's target column already matches, and once right after
 * the driver latches the object onto the player box (a death-pose sprite + a sound).
 * Which game event the expiry ultimately gates — a lost life versus some other mode
 * change — is still an open question, so the routine keeps its address name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3458.test.js.
 * GATE:     crafted-entry — 0x3458's arrival/collision entry is never reached in a
 *           plain attract run, so the gate captures a real attract machine state and
 *           sweeps the countdown 0x808b across all 256 values (its only branch input).
 *           The expiry branch runs the real round/state-boundary transition (dockManAndDispatchRoundBoundary),
 *           whose own still-oracle successors busy-wait on the vblank NMI off a
 *           single-routine clone, so the gate stubs those successors identically on
 *           both sides.
 * LIVE-OUT: memory-only — the decremented countdown, plus (on a fourth tick) the two
 *           flipped flags. No caller reads a value register (dead ABI); the expiry
 *           branch is a JS tail return of the transition's own result.
 * NAMES:    ENEMY_ACTION_TIMER (0x808b, serving here as the state countdown), ENEMY_WORK_SPRITE
 *           (0x8084), PLAYER_FACING (0x8069).
 *
 * PURPOSE [guess]: which game event the expiry gates (lost life vs other).
 */

import { ENEMY_ACTION_TIMER, ENEMY_WORK_SPRITE, PLAYER_FACING } from "./names.js";
import { dockManAndDispatchRoundBoundary } from "./dockManAndDispatchRoundBoundary.js";

export function tickObjectDwellThenTransition(m) {
  const { mem8 } = m;

  // Knock one off the countdown (the byte store wraps 0 back round to 255).
  const remaining = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = remaining;

  // The tick that reaches zero ends the wait: hand off to the round/state-boundary transition.
  // The frozen oracle tail-jumps into a fresh never-returning main loop; in the coroutine model
  // that is a mid-frame warm restart — abandon this frame and swap the whole main generator
  // (m.restartMain throws RESTART, caught by runGeneratorGame).
  if (remaining === 0) return m.restartMain(() => dockManAndDispatchRoundBoundary(m));

  // Otherwise act only on every fourth tick; all other ticks just let the timer run.
  if ((remaining & 3) !== 0) return;

  // Flip the shared top (flip / frame-select) bit of the actor-state flag and the
  // sprite code together, advancing the actor's two-frame blink.
  mem8[ENEMY_WORK_SPRITE] ^= 0x80;
  mem8[PLAYER_FACING] ^= 0x80;
}
