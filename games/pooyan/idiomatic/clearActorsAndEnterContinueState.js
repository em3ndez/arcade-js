// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { stampSecondScrollColumn } from "./stampSecondScrollColumn.js";
import { stampCappedTileColumnUp } from "./stampCappedTileColumnUp.js";
import { resetGameToAttractState } from "./resetGameToAttractState.js";
import {
  SPEED_INDEX,
  TWO_PLAYER_FLAG,
  CREDIT_COUNT,
  GAME_ACTIVE_FLAG,
  PLAY_STATE_INDEX,
  FLIP_SCREEN_FLAG,
  MAIN_GAME_STATE,
} from "./names.js";
/**
 * clearActorsAndEnterContinueState — full-clear tail of the play-state dispatch handler.
 *
 * Zero-fills the live actor page, then reseeds one player through the sprite-slot body: the two-player
 * flag picks the fixed-stride paint or the cap-first stamp (exactly one runs — the picked branch leaves
 * the decision flag intact). With no credit left it delegates to the cold teardown; otherwise it
 * finishes the player-continue path (clear the active gate and sub-state, arm flip and the continue
 * state) and returns.
 *
 * LIVE-OUT: none — a void handler.
 */

const PAGE_LEN = 0xbf;
const CONTINUE_STATE = 2;

export function clearActorsAndEnterContinueState(m) {
  const { mem8 } = m;

  fillByteRun(m, SPEED_INDEX, 0, PAGE_LEN); // zero-fill the live actor page

  if (mem8[TWO_PLAYER_FLAG] === 0) stampSecondScrollColumn(m); // fixed-stride paint
  else stampCappedTileColumnUp(m); // cap-first column stamp

  if (mem8[CREDIT_COUNT] === 0) return resetGameToAttractState(m); // no credit -> cold teardown

  mem8[GAME_ACTIVE_FLAG] = 0;
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[FLIP_SCREEN_FLAG] = 1;
  mem8[MAIN_GAME_STATE] = CONTINUE_STATE;
}
