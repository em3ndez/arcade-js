// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_138f — one-shot timed sub-state transition: wait out the sub-state timer, then jump to one
 * of two follow-on sub-states depending on whether player 2 has a game in progress. A twin handler
 * is identical but reads player 1's context instead.
 *
 * LIVE-OUT: memory-only. The dispatcher discards this handler's result.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { SUBSTATE_TIMER, GAME_SUBSTATE, P2_CONTEXT } from "./names.js";

const SUBSTATE_P2_LIVE = 0x17; // P2 still has a saved game
const SUBSTATE_P2_DEAD = 0x14; // P2 has none

export function loc_138f(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  // Re-arm the timer to 1: one frame of grace before the next sub-state runs.
  mem8[SUBSTATE_TIMER] = (mem8[SUBSTATE_TIMER] + 1);

  mem8[GAME_SUBSTATE] = mem8[P2_CONTEXT] !== 0 ? SUBSTATE_P2_LIVE : SUBSTATE_P2_DEAD;
}
