// SPDX-License-Identifier: GPL-3.0-only
import {
  TWO_PLAYER_FLAG,
  PLAYER1_LIVES,
  ACTIVE_PLAYER,
  SPEED_INDEX,
  PLAYER0_STATE_BANK,
  PLAY_STATE_INDEX,
} from "./names.js";
/**
 * saveLivePageToPlayer0Bank — snapshot the live actor/state page into player 0's saved bank.
 *
 * Copies the 0x3f-byte live page into player-0's bank and resets the play sub-state index.
 * In a two-player game whose player 1 is still alive it first latches the active-player flag.
 * A leaf: touches only these cells, calls nothing.
 *
 * LIVE-OUT: memory-only — the copied bank, the (conditional) active-player latch, and the
 * cleared state index. No register or flag is returned.
 */

// SPEED_INDEX doubles as the base of the live actor/state page copied here.
const LIVE_PAGE = SPEED_INDEX;
const BANK_SIZE = 0x3f;

export function saveLivePageToPlayer0Bank(m) {
  const { mem8 } = m;

  // Two-player game with player 1 still alive -> mark the active player.
  if (mem8[TWO_PLAYER_FLAG] !== 0 && mem8[PLAYER1_LIVES] !== 0) {
    mem8[ACTIVE_PLAYER] = 1;
  }

  for (let i = 0; i < BANK_SIZE; i++) {
    mem8[PLAYER0_STATE_BANK + i] = mem8[LIVE_PAGE + i];
  }

  mem8[PLAY_STATE_INDEX] = 0;
}
