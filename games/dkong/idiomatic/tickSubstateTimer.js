// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstateTimer — tick the sub-state countdown, report expiry.  ROM 0x0018.
 *
 * The `rst 0x18` skip helper: a "do it every Nth frame" gate. Each call decrements
 * SUBSTATE_TIMER (0x6009) in place and tells the caller whether it just hit ZERO.
 * On expiry the caller's remainder runs ("the timer elapsed, do the thing"); while
 * the counter is still non-zero the caller is skipped. Polarity matters — the
 * remainder runs only on EXPIRY, and reading it the other way inverts the routine.
 *
 * The oracle expresses "skip the caller" the Z80 way: `dec (hl)` then `ret z` for the
 * expiry path, and on the non-zero path two `inc sp` that discard this routine's OWN
 * return address so the final `ret` lands in the caller's CALLER. The direct-call
 * model dissolves that stack surgery into a plain boolean return that the caller
 * consumes as `if (!tickSubstateTimer(m)) return;` — false ("not expired yet") makes
 * the caller return immediately, true lets its remainder run.
 *
 * A LEAF: reads and writes only SUBSTATE_TIMER, calls nothing. (Its sibling rst 0x20,
 * sub_0020, tail-jumps in here on its own expiry to form a two-level prescaler; that
 * caller still consumes the same boolean.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-0018.test.js.
 * GATE:     exhaustive — a total function of SUBSTATE_TIMER's byte, compared to the
 *           oracle over all 256 values on RAM + the returned boolean; plus real
 *           captured rst-0x18 dispatches from an attract run. Reached from ~50 sites.
 * LIVE-OUT: memory (SUBSTATE_TIMER decremented) + the boolean return (expiry). The
 *           oracle's SP/PC churn is the Z80 caller-skip mechanism this boolean
 *           replaces, so SP/PC are NOT part of the contract; its residual HL/A/F are
 *           dead ABI.
 * NAMES:    SUBSTATE_TIMER (0x6009) — from ram.js.
 */

import { SUBSTATE_TIMER } from "../optimized/ram.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean} true when the counter reached 0 (expired — run the caller's
 *   remainder); false while it is still counting down (skip the caller).
 */
export function tickSubstateTimer(m) {
  const { mem } = m;
  const remaining = (mem.read8(SUBSTATE_TIMER) - 1) & 0xff; // dec (hl)
  mem.write8(SUBSTATE_TIMER, remaining);
  return remaining === 0; // ret z: expired -> caller's remainder runs
}
