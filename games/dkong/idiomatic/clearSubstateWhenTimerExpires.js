// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSubstateWhenTimerExpires — park on a timed sub-state, then clear the
 * sub-state index once the two-level countdown expires.  ROM 0x084b.
 *
 * A sub-state handler dispatched on GAME_SUBSTATE (0x600A) — entry 7 of the
 * game-state-1 (attract) sub-state table at ROM 0x0748. It is the "wait, then move
 * on" step: each frame it runs the two-level sub-state countdown through the rst-0x20
 * skip helper (tickSubstatePrescaler → tickSubstateTimer, ticking SUBSTATE_TIMER_LO
 * 0x6008 and, on its underflow, SUBSTATE_TIMER 0x6009). While either half is still
 * counting the helper returns false and this routine does nothing more, so the
 * sub-state stays parked. Only when BOTH halves expire on the same frame does it clear
 * GAME_SUBSTATE to 0, ending the wait so the state's sub-sequence restarts at index 0
 * on the next dispatch. (Observed live: attract dispatches it 512× on 0x600A == 7 with
 * 0x6009 == 2, walking 0x6008 down each frame.)
 *
 * A void handler — it returns nothing its dispatcher consumes. In the oracle the
 * `rst 0x20` skip only unwinds the return address the `rst` itself pushed, so control
 * lands back in the dispatcher on BOTH branches (a normal return); only the 0x600A
 * clear differs. All of that oracle SP/PC/HL churn is the Z80 skip mechanism, dissolved
 * here into the callee's boolean return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-084b.test.js.
 * GATE:     exhaustive — a total function of the two timer bytes SUBSTATE_TIMER_LO
 *           (0x6008) and SUBSTATE_TIMER (0x6009); candidate == oracle on RAM (minus
 *           STACK_SCRATCH) over all 65,536 (lo,hi) combos, plus real captured 0x084b
 *           dispatches from an attract run. Reached at game-state-1 sub-state 7.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER_LO / SUBSTATE_TIMER ticked inside the callee,
 *           and GAME_SUBSTATE (0x600A) cleared on the both-expired branch. No live
 *           registers/flags (the oracle's residual HL/A/F are dead ABI); SP/PC are the
 *           caller-skip mechanism, not part of the contract, and the oracle's pushed
 *           return byte lands in the dead STACK_SCRATCH.
 * NAMES:    GAME_SUBSTATE (0x600A) — from ram.js; the timer bytes are named and ticked
 *           inside the tickSubstatePrescaler callee.
 */

import { GAME_SUBSTATE } from "./ram.js";
import { tickSubstatePrescaler } from "./tickSubstatePrescaler.js";

/**
 * @param {object} m  the machine (uses m.mem, plus the callee's tick of 0x6008/0x6009).
 */
export function clearSubstateWhenTimerExpires(m) {
  const { mem } = m;
  // rst 0x20 — tick the two-level sub-state countdown; skip the rest unless BOTH
  // halves expire on this frame.
  if (!tickSubstatePrescaler(m)) return;
  // Both prescalers expired — end the wait: GAME_SUBSTATE <- 0.
  mem.write8(GAME_SUBSTATE, 0x00);
}
