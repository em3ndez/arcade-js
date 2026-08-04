// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstatePrescaler — tick the low half of the sub-state timer; on its underflow
 * chain into the high half.  ROM 0x0020.
 *
 * The `rst 0x20` skip helper, and the fast stage of a TWO-LEVEL countdown. Each call
 * decrements SUBSTATE_TIMER_LO (0x6008), the low/fast prescaler. While that is still
 * counting, the caller's remainder is skipped. Only when the prescaler underflows to 0
 * does control chain into rst 0x18 (tickSubstateTimer), which ticks the high half
 * SUBSTATE_TIMER (0x6009) one notch and reports ITS expiry. So the caller's remainder
 * runs only when BOTH counters expire together — the "wait N·M frames, then advance the
 * sub-state" idiom, expressed as two prescalers in series.
 *
 * The oracle expresses "skip the caller" the Z80 way: on the prescaler-not-yet-zero
 * path a `pop hl / ret` discards this routine's OWN return address so the final `ret`
 * lands in the caller's CALLER; on the zero path a `jr z` TAIL-jumps into sub_0018's
 * first instruction, so sub_0018's `ret` returns on 0x0020's behalf and 0x0020 never
 * reaches a `ret` of its own. The direct-call model dissolves all of that stack surgery
 * into a plain boolean the caller consumes as `if (!tickSubstatePrescaler(m)) return;` —
 * false ("not time yet") makes the caller return immediately, true lets its remainder
 * run. That mirrors the callee tickSubstateTimer's own convention, which is why the two
 * `rst` handlers must share it (sub_0020 tail-jumps straight into sub_0018).
 *
 * Reached from two timed-advance sites (loc_084b, handler_0763), both of which discard
 * HL/A the instant control returns, so nothing downstream reads the registers the
 * oracle leaves behind.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0020.test.js.
 * GATE:     exhaustive — a total function of the two timer bytes SUBSTATE_TIMER_LO
 *           (0x6008) and SUBSTATE_TIMER (0x6009), compared to the oracle over all
 *           65,536 (lo,hi) combos on RAM + the returned boolean; plus real captured
 *           rst-0x20 dispatches from an attract run. Reached from 2 sites.
 * LIVE-OUT: memory (SUBSTATE_TIMER_LO always decremented; SUBSTATE_TIMER also
 *           decremented on prescaler underflow, via tickSubstateTimer) + the boolean
 *           return (both counters expired -> run the caller's remainder). The oracle's
 *           SP/PC churn is the Z80 caller-skip mechanism this boolean replaces, so SP/PC
 *           are NOT part of the contract; its residual HL/A/F are dead ABI (both callers
 *           reload HL/A the instant the helper returns).
 * NAMES:    SUBSTATE_TIMER_LO (0x6008) — from names.js; SUBSTATE_TIMER (0x6009) is ticked
 *           inside the tickSubstateTimer callee.
 */

import { SUBSTATE_TIMER_LO } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean} true when BOTH counters expired this call (run the caller's
 *   remainder); false while either counter is still counting down (skip the caller).
 */
export function tickSubstatePrescaler(m) {
  const { mem } = m;
  // `ld hl,0x6008 / dec (hl)` — tick the low/fast prescaler.
  const remaining = (mem.read8(SUBSTATE_TIMER_LO) - 1) & 0xff;
  mem.write8(SUBSTATE_TIMER_LO, remaining);
  // `jr z,0x0018`: while the prescaler is still counting the caller is skipped (the
  // oracle's `pop hl / ret` returns two levels up). Only on its underflow does control
  // fall into rst 0x18 to tick the high half, whose expiry decision becomes ours.
  if (remaining !== 0) return false;
  return tickSubstateTimer(m);
}
