// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstateTimer — tick the sub-state countdown one frame and report whether it just expired.
 *
 * The shared "wait N frames, then do it" gate. Each call counts SUBSTATE_TIMER down by one in
 * place and reports whether that tick is the one that brought it to ZERO. On expiry the caller
 * goes on and does its work; while the counter is still above zero the caller is expected to
 * abandon the rest of its frame. Polarity matters — the work runs only on EXPIRY, so reading the
 * result the other way round inverts every caller at once.
 *
 * The report is a plain boolean, consumed as `if (!tickSubstateTimer(m)) return;`: false means
 * "not expired yet, do nothing more this frame", true means "the countdown elapsed, carry on".
 *
 * A LEAF: it reads and writes only SUBSTATE_TIMER and calls nothing. A slower prescaler chains
 * into it on its own underflow, which turns the pair into a two-level countdown; that caller
 * consumes the same boolean as any other.
 *
 * LIVE-OUT: SUBSTATE_TIMER, decremented — plus the boolean, which is the whole point of the call.
 */

import { SUBSTATE_TIMER } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean} true when the counter reached 0 (expired — run the caller's
 *   remainder); false while it is still counting down (skip the caller).
 */
export function tickSubstateTimer(m) {
  const { mem } = m;
  const before = mem.read8(SUBSTATE_TIMER);
  // Count down one; the store wraps a past-zero decrement (before == 0) to 255.
  mem.write8(SUBSTATE_TIMER, before - 1);
  // Expired exactly when it was 1 going in — that is the only tick that lands on 0.
  return before === 1;
}
