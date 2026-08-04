// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstatePrescaler — tick the low half of the sub-state timer; on its underflow chain
 * into the high half.
 *
 * The fast stage of a TWO-LEVEL countdown, and a caller-skip helper. Each call decrements
 * SUBSTATE_TIMER_LO, the low/fast prescaler. While that is still counting, the caller's
 * remainder is skipped. Only when the prescaler underflows to 0 does control chain into the
 * high-half tick, which steps SUBSTATE_TIMER one notch and reports ITS expiry. So the caller's
 * remainder runs only when BOTH counters expire together — the "wait N·M frames, then advance
 * the sub-state" idiom, expressed as two prescalers in series.
 *
 * The hardware expresses "skip the caller" by discarding this routine's own return address on
 * the still-counting path, so the return lands one level higher; on the underflow path it
 * tail-jumps into the high-half tick, which then returns on this routine's behalf. Both are
 * modelled here as a plain boolean the caller consumes as
 * `if (!tickSubstatePrescaler(m)) return;` — false ("not time yet") makes the caller return
 * immediately, true lets its remainder run. That is the same convention the high-half tick
 * uses, which is why the two must share it.
 *
 * LIVE-OUT: memory (SUBSTATE_TIMER_LO always decremented; SUBSTATE_TIMER also decremented on
 * prescaler underflow) plus the boolean — both counters expired, so run the caller's
 * remainder.
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
  // Tick the low/fast prescaler.
  const remaining = (mem.read8(SUBSTATE_TIMER_LO) - 1) & 0xff;
  mem.write8(SUBSTATE_TIMER_LO, remaining);
  // While the prescaler is still counting, the caller is skipped. Only on its underflow does
  // control fall into the high-half tick, whose expiry decision becomes ours.
  if (remaining !== 0) return false;
  return tickSubstateTimer(m);
}
