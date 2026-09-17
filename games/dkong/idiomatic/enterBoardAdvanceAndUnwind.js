// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterBoardAdvanceAndUnwind — commit the board-cleared/advance sub-state, then unwind out of the
 * movement cascade so no further movement runs the frame the board is won.
 *
 * LIVE-OUT: the game sub-state in memory, plus the boolean unwind signal (false).
 */

import { GAME_SUBSTATE } from "./names.js";

export function enterBoardAdvanceAndUnwind(m) {
  const { mem8 } = m;

  mem8[GAME_SUBSTATE] = 0x16;

  return false;
}
