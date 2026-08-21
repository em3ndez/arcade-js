// SPDX-License-Identifier: GPL-3.0-only
/**
 * saveLiveStateToPlayerBank — save the live actor/state page into the active player's bank.
 *
 * Clears the (page:0x04) status byte the caller seated in the H page, then block-copies the
 * 0x3f-byte live page into the active player's saved bank — player 0's unless ACTIVE_PLAYER is
 * nonzero, then player 1's — and finally zeroes PLAY_STATE_INDEX. A pure leaf: writes RAM only.
 *
 * LIVE-OUT: memory-only. No register or flag is returned.
 */
import {
  ACTIVE_PLAYER,
  PLAYER0_STATE_BANK,
  PLAYER1_STATE_BANK,
  PLAY_STATE_INDEX,
  SPEED_INDEX,
} from "./names.js";

const LIVE_STATE_PAGE = SPEED_INDEX; // base of the live actor/state page — SPEED_INDEX is its byte 0
const BANK_SIZE = 0x3f;

export function saveLiveStateToPlayerBank(m, callerPage = m.regs.h) {
  const { mem8 } = m;

  mem8[(callerPage << 8) | 0x04] = 0x00; // clear the (page:04) status byte the caller seated

  const dest = mem8[ACTIVE_PLAYER] === 0 ? PLAYER0_STATE_BANK : PLAYER1_STATE_BANK;
  for (let i = 0; i < BANK_SIZE; i++) mem8[dest + i] = mem8[LIVE_STATE_PAGE + i];

  mem8[PLAY_STATE_INDEX] = 0x00;
}
