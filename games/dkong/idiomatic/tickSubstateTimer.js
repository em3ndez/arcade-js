// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstateTimer — tick the sub-state countdown, report expiry.  ROM 0x0018.
 *
 * A shared "do it every Nth frame" gate, reached through the 0x18 restart vector.
 * Each call counts SUBSTATE_TIMER (0x6009) down by one in place and reports whether
 * that tick brought it to ZERO. On expiry the caller's remainder runs ("the countdown
 * elapsed — now do the thing"); while the counter is still above zero the caller is
 * skipped entirely and does nothing this frame. Polarity matters: the remainder runs
 * only on EXPIRY, so reading the result the other way inverts the whole routine.
 *
 * The oracle expresses "skip the caller" with the caller-skip method: on the
 * not-yet-expired path it discards its own return slot so control resumes two levels
 * up instead of one, bypassing everything after the call. The direct-call form drops
 * that stack surgery and returns a plain boolean the caller consumes as
 * `if (!tickSubstateTimer(m)) return;` — false ("not expired yet") makes the caller
 * return immediately, true lets its remainder run.
 *
 * A LEAF: reads and writes only SUBSTATE_TIMER, calls nothing. Its sibling prescaler
 * (tickSubstatePrescaler, ROM 0x0020) chains in here on its own underflow to form a
 * two-level countdown, and consumes this same boolean.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0018.test.js.
 * GATE:     exhaustive — a total function of SUBSTATE_TIMER's one byte, compared to
 *           the oracle over all 256 values on RAM + the returned boolean; plus real
 *           captured 0x18 dispatches from an attract run. Reached from ~50 timed-gate
 *           sites and from the sibling prescaler at 0x0020.
 * LIVE-OUT: memory (SUBSTATE_TIMER decremented) + the boolean return (expiry). The
 *           oracle's SP/PC churn is the caller-skip mechanism this boolean replaces, so
 *           SP/PC are NOT part of the contract; its residual HL/A/F are dead ABI (every
 *           caller consumes only the control-flow decision, never those registers).
 * NAMES:    SUBSTATE_TIMER (0x6009) — from names.js.
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
