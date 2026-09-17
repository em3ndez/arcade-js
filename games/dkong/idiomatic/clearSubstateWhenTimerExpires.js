// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSubstateWhenTimerExpires — run the two-level sub-state countdown; when both halves
 * expire on the same frame, clear GAME_SUBSTATE so the sub-sequence restarts from 0.
 *
 * LIVE-OUT: memory-only — the two countdown bytes (ticked in the callee) and GAME_SUBSTATE
 * cleared on the both-expired branch.
 */

import { GAME_SUBSTATE } from "./names.js";
import { tickSubstatePrescaler } from "./tickSubstatePrescaler.js";

export function clearSubstateWhenTimerExpires(m) {
  const { mem8 } = m;
  if (!tickSubstatePrescaler(m)) return;
  mem8[GAME_SUBSTATE] = 0x00;
}
