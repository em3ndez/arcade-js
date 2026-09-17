// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickSubstateTimer — count SUBSTATE_TIMER down one frame in place and return whether that tick
 * brought it to zero. The shared "wait N frames, then do it" gate: true means expired (run the
 * caller's remainder), false means keep waiting. A past-zero decrement wraps to 255.
 *
 * LIVE-OUT: SUBSTATE_TIMER, decremented — plus the boolean.
 */

import { SUBSTATE_TIMER } from "./names.js";

export function tickSubstateTimer(m) {
  const { mem8 } = m;
  const before = mem8[SUBSTATE_TIMER];
  mem8[SUBSTATE_TIMER] = before - 1;
  return before === 1;
}
