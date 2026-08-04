// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_12de — on sub-state-timer expiry, tear down the finished sub-state's sprite scratch, advance
 *   GAME_SUBSTATE, and re-arm the timer to fire immediately.
 *
 * The hand-off arm of Mario's death animation — the last step. It fires once, after the pause the
 * previous arm arms, and passes control to the life-loss handler, where a life comes off. It is
 * polled every frame but gates itself on SUBSTATE_TIMER: while that counter is still counting down
 * the dispatch is abandoned for the frame and nothing here runs. On the one frame the counter
 * EXPIRES it:
 *   1. clears the sprite scratch the finished sub-state is done with — the leading (X) byte of
 *      Mario's sprite record and six shadow records inside the sprite buffer;
 *   2. advances GAME_SUBSTATE — by ONE normally, by TWO when ACTIVE_PLAYER_INDEX is non-zero; and
 *   3. re-arms SUBSTATE_TIMER to 1, so the very next poll expires at once and control passes
 *      straight on to the freshly-selected sub-state. (A sibling hand-off arms a long timer
 *      instead, to HOLD the new state; this one does not.)
 *
 * THE DOUBLE-ADVANCE ARM IS LIVE CODE. It is what routes the second player's death to the second
 * player's life-loss handler instead of the first player's, and a real two-player game takes it on
 * every P2 death.
 *
 * THE NAME STAYS loc_: no derivation earning an English name has been produced for this routine.
 *
 * LIVE-OUT: memory-only — SUBSTATE_TIMER, GAME_SUBSTATE, and the seven sprite-scratch bytes
 * cleared. Control returns into a dispatch that reads no register or flag left behind.
 */

import { GAME_SUBSTATE, SUBSTATE_TIMER, ACTIVE_PLAYER_INDEX } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loc_30db } from "./loc_30db.js";

export function loc_12de(m) {
  const { mem } = m;

  // The gate: tick SUBSTATE_TIMER. Not expired -> the dispatch is abandoned this frame.
  if (!tickSubstateTimer(m)) return;

  // Clear the sprite scratch the finished sub-state is done with.
  loc_30db(m);

  // Advance GAME_SUBSTATE: +1 for a one-player game, +2 when ACTIVE_PLAYER_INDEX is non-zero.
  // Two 8-bit increments in a row equal one (+2 mod 256), so a single wrapping add reproduces the
  // same value for both arms.
  const extra = mem.read8(ACTIVE_PLAYER_INDEX) !== 0 ? 1 : 0;
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1 + extra) & 0xff);

  // Re-arm SUBSTATE_TIMER to 1 so the next poll expires immediately.
  mem.write8(SUBSTATE_TIMER, 0x01);
}
