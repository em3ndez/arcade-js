// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstatePrescaler — the fast stage of a two-level countdown. Decrement SUBSTATE_TIMER_LO;
 * while it is still counting return false (skip the caller). Only on its underflow chain into
 * the high-half tick, whose expiry decision becomes the return — so the caller's remainder runs
 * only when both counters expire together.
 *
 * LIVE-OUT: memory (SUBSTATE_TIMER_LO always decremented; SUBSTATE_TIMER also on underflow) plus
 * the boolean.
 */

import { SUBSTATE_TIMER_LO } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

export function tickSubstatePrescaler(m) {
  const { mem8 } = m;
  const remaining = (mem8[SUBSTATE_TIMER_LO] - 1) & 0xff;
  mem8[SUBSTATE_TIMER_LO] = remaining;
  if (remaining !== 0) return false;
  return tickSubstateTimer(m);
}
