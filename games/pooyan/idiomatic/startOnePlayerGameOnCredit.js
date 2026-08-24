// SPDX-License-Identifier: GPL-3.0-only
import { startNewGamePlay } from "./startNewGamePlay.js";
import { CREDIT_COUNT, PLAY_STATE_INDEX, MAIN_GAME_STATE } from "./names.js";
/**
 * startOnePlayerGameOnCredit — the input-port bit-3 coin/credit branch.
 *
 * When credits remain it spends one and restarts a fresh single-player game (start-of-life setup
 * for a new game, active-player word = 0). Otherwise, unless play has reached sub-state 0x0e, it
 * nudges the main state to 1.
 *
 * LIVE-OUT: memory only — callers read no register back.
 */
const PLAY_STATE_LOCKED = 0x0e; //  sub-state past which the main-state nudge is suppressed

export function startOnePlayerGameOnCredit(m) {
  const { mem8 } = m;

  if (mem8[CREDIT_COUNT] !== 0) {
    mem8[CREDIT_COUNT] = (mem8[CREDIT_COUNT] - 1) & 0xff;
    return startNewGamePlay(m, 0x0000); //  restart a single-player game
  }

  if (mem8[PLAY_STATE_INDEX] === PLAY_STATE_LOCKED) return;
  mem8[MAIN_GAME_STATE] = 1;
}
