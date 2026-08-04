// SPDX-License-Identifier: GPL-3.0-only
/**
 * startBonusExpiredDelay — arm the DELAY phase of the bonus-expired death sequence.
 *
 * BONUS_EXPIRED_STEP is a tiny four-state machine that the per-frame gameplay cascade
 * dispatches on every frame. Both bonus-decrement sites set it to 1 the moment the
 * on-screen BONUS reaches 0, arming the "bonus expired -> kill the player" sequence:
 *
 *   state 0   no-op                 BONUS still above 0 — do nothing
 *   state 1   THIS routine          INIT: clear the delay, go to state 2
 *   state 2   DELAY                 count BONUS_EXPIRED_DELAY down; at 0 -> state 3
 *   state 3   WAIT + EXIT           once Mario is no longer airborne, take the death exit
 *
 * As state 1 this routine is the one-shot INIT. It reads nothing and does exactly two
 * constant stores:
 *
 *   - clears the delay counter BONUS_EXPIRED_DELAY to 0. State 2 then counts that byte
 *     down and returns while it is still non-zero, so the first decrement wraps 0 -> 255
 *     — a 256-frame delay — before the sequence advances to state 3.
 *   - advances BONUS_EXPIRED_STEP from 1 (INIT) to 2 (DELAY).
 *
 * Both targets are plain work RAM with no cross-dependency, so the store order is
 * immaterial. The routine calls nothing.
 *
 * LIVE-OUT: memory-only — BONUS_EXPIRED_DELAY := 0 and BONUS_EXPIRED_STEP := 2. The
 * dispatcher discards whatever this handler leaves behind.
 */

import { BONUS_EXPIRED_STEP, BONUS_EXPIRED_DELAY } from "./names.js";

export function startBonusExpiredDelay(m) {
  const { mem } = m;

  // Clear the delay counter; state 2 counts it down, and its first decrement wraps
  // 0 -> 255 for a full 256-frame delay before the sequence advances.
  mem.write8(BONUS_EXPIRED_DELAY, 0);

  // Advance the bonus-expired state machine from INIT (1) to DELAY (2).
  mem.write8(BONUS_EXPIRED_STEP, 2);
}
