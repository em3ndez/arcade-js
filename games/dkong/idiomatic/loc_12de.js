// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_12de — on sub-state-timer expiry, tear down the finished sub-state's sprite scratch, advance
 * GAME_SUBSTATE (by +1 normally, +2 when ACTIVE_PLAYER_INDEX is non-zero, which routes P2's death
 * to P2's life-loss handler), and re-arm the timer to fire immediately.
 *
 * LIVE-OUT: memory-only — SUBSTATE_TIMER, GAME_SUBSTATE, and the sprite-scratch bytes cleared.
 */

import { GAME_SUBSTATE, SUBSTATE_TIMER, ACTIVE_PLAYER_INDEX } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loc_30db } from "./loc_30db.js";

export function loc_12de(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  loc_30db(m);

  const extra = mem8[ACTIVE_PLAYER_INDEX] !== 0 ? 1 : 0;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1 + extra) & 0xff;

  mem8[SUBSTATE_TIMER] = 0x01;
}
