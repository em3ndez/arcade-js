// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterBoardAdvanceAndUnwind — commit "this board is complete": set the board-advance sub-state,
 * then unwind out of the movement cascade.
 *
 * The shared completion tail of Mario's per-frame position check, reached from either
 * board-clear condition: a rivet board whose last rivet has been collected, or any non-rivet
 * board where Mario has climbed to the rescue row near Pauline. Both mean the board is won, so
 * this sets the game's sub-state to the board-cleared/advance one, which plays the
 * board-advance interlude and steps on to the next board.
 *
 * It then UNWINDS: control returns one extra level up, straight out of the movement cascade, so
 * no further movement is processed on the frame the board is won. In direct-call form that
 * non-local exit is a boolean — false, meaning "abort: do not continue".
 *
 * A LEAF: writes one byte, reads nothing, calls nothing.
 *
 * LIVE-OUT: the game sub-state in memory, plus the boolean unwind signal.
 */

import { GAME_SUBSTATE } from "./names.js";

export function enterBoardAdvanceAndUnwind(m) {
  // The board is won — enter the board-cleared/advance sub-state, which plays the interlude and
  // steps to the next board.
  m.mem.write8(GAME_SUBSTATE, 0x16);

  // Unwind out of the movement cascade: abort the caller (and its caller), so no further
  // movement runs on the frame the board is won.
  return false;
}
