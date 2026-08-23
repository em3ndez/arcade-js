// SPDX-License-Identifier: GPL-3.0-only
import { loc_2527 } from "./loc_2527.js";
import { loc_02b9 } from "./loc_02b9.js";
import { u16 } from "../../../core/int.js";
import {
  GAME_ACTIVE_FLAG,
  COINAGE_CONFIG,
  CREDIT_COUNT,
  MAIN_GAME_STATE,
  PLAY_STATE_INDEX,
  RESET_ATTR_COLUMN,
} from "./names.js";
/**
 * resetToBoardBuildToContinuePlay — the play dispatcher's post-dispatch continuation (end-of-life housekeeping).
 *
 * Runs after the per-frame play handler returns. Bails to the frame caller while a game is still
 * active; on free play it tail-delegates to the shared attract epilogue; with no credit left it
 * returns. Otherwise it drops the machine back to the board-build state (main state 2, sub-index 0),
 * runs the board/HUD reset and the arena clear, then blanks an eight-tile attribute column upward.
 * LIVE-OUT: none — the frame caller restores every register.
 */
const BOARD_BUILD_STATE = 0x02;
const FREE_PLAY = 0x0f;
const BLANK_TILE = 0x10;
const COLUMN_HEIGHT = 0x08;
const ROW_STRIDE = 0x20; // one tile row; the column is walked upward, so the address descends

export function resetToBoardBuildToContinuePlay(m) {
  const { mem8 } = m;

  if (mem8[GAME_ACTIVE_FLAG] !== 0) return; // game still live -> nothing to do
  if (mem8[COINAGE_CONFIG] === FREE_PLAY) return m.call(0x0bb5); // free play -> shared epilogue tail
  if (mem8[CREDIT_COUNT] === 0) return; // no credit -> stay put

  mem8[MAIN_GAME_STATE] = BOARD_BUILD_STATE; // rebuild the board next
  mem8[PLAY_STATE_INDEX] = 0x00;
  loc_2527(m); // board/HUD reset
  loc_02b9(m); // clear the actor/object arena

  let cell = RESET_ATTR_COLUMN;
  for (let i = 0; i < COLUMN_HEIGHT; i++) { // blank the column, one row up per step
    mem8[cell] = BLANK_TILE;
    cell = u16(cell - ROW_STRIDE);
  }
}
