// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { loc_02e3 } from "./loc_02e3.js";
import { clearActorsAndEnterContinueState } from "./clearActorsAndEnterContinueState.js";
import { stampSecondScrollColumn } from "./stampSecondScrollColumn.js";
import {
  PLAYER1_LIVES,
  PLAY_STATE_INDEX,
  PLAYER0_STATE_BANK,
  ACTIVE_PLAYER,
} from "./names.js";
/**
 * reseedOtherPlayerForTurn — reseed-the-other-player tail of the play-state dispatch handler.
 *
 * With no lives left for player one it delegates to the full-clear tail. Otherwise it clears the
 * play sub-state, fills player zero's state bank with zeros, marks player one active, runs the
 * pointer-reset helper, and falls through into the shared reseed body.
 *
 * LIVE-OUT: none — a void handler ending in a tail delegate.
 */

const BANK_LEN = 0x3f;

export function reseedOtherPlayerForTurn(m) {
  const { mem8 } = m;

  if (mem8[PLAYER1_LIVES] === 0) return clearActorsAndEnterContinueState(m);

  mem8[PLAY_STATE_INDEX] = 0;
  loc_0010(m, PLAYER0_STATE_BANK, 0, BANK_LEN); // zero-fill player zero's state bank
  mem8[ACTIVE_PLAYER] = 1; // the fill leaves A zero -> increment is one
  loc_02e3(m); // reset the display pointer
  return stampSecondScrollColumn(m);
}
