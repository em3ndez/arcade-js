// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSubstateWhenTimerExpires — park on a timed sub-state, then clear the sub-state index once
 * the two-level countdown expires.
 *
 * One of the attract state's sub-state handlers, and the "wait, then move on" step of that
 * sequence. Each frame it runs the two-level sub-state countdown, which ticks a low prescaler byte
 * and, on that byte's underflow, the sub-state timer above it. While either half is still counting
 * the countdown reports back false and this routine does nothing more, so the sub-state stays
 * parked. Only when BOTH halves expire on the same frame does it clear GAME_SUBSTATE to 0, ending
 * the wait so the state's sub-sequence restarts from index 0 on the next dispatch.
 *
 * Observed live: attract dispatches it 512 times at sub-state 7, with the upper half of the
 * countdown sitting at 2 while the prescaler walks down each frame.
 *
 * A void handler — it returns nothing its dispatcher consumes, and control reaches the dispatcher
 * again on both branches. Only the sub-state clear differs between them.
 *
 * LIVE-OUT: memory-only — the two countdown bytes ticked inside the countdown helper, and
 * GAME_SUBSTATE cleared on the both-expired branch.
 */

import { GAME_SUBSTATE } from "./names.js";
import { tickSubstatePrescaler } from "./tickSubstatePrescaler.js";

/**
 * @param {object} m  the machine; the countdown bytes are ticked inside the callee.
 */
export function clearSubstateWhenTimerExpires(m) {
  const { mem } = m;
  // Tick the two-level sub-state countdown; skip the rest unless BOTH halves expire this frame.
  if (!tickSubstatePrescaler(m)) return;
  // Both prescalers expired — end the wait: GAME_SUBSTATE <- 0.
  mem.write8(GAME_SUBSTATE, 0x00);
}
