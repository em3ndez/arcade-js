// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13a1 — timer-gated in-game sub-state handler: wait out the sub-state countdown, then pick
 * the next sub-state from player 1's saved life count (non-zero keeps this handler, zero hands off).
 *
 * LIVE-OUT: memory-only — the sub-state countdown and the sub-state selector.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, P1_CONTEXT } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

export function loc_13a1(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  // Re-arm the just-expired countdown to 1 so the handler fires again next frame.
  mem8[SUBSTATE_TIMER] = (mem8[SUBSTATE_TIMER] + 1) & 0xff;

  const p1 = mem8[P1_CONTEXT];
  mem8[GAME_SUBSTATE] = p1 !== 0 ? 0x17 : 0x14;
}
