// SPDX-License-Identifier: GPL-3.0-only
/**
 * armTwoPlayerBoardSetup — the 2-player arm of the board-setup step: clear the two board
 * control latches, post two draw tasks ([opcode 3, arg 2] then [opcode 2, arg 1]), advance the
 * game sub-state 2 -> 5, then FALL THROUGH into the shared 3-cell column painter, whose own
 * return is what returns from here.
 *
 * LIVE-OUT: memory — the two latches, the two posted ring slots and the ring tail, the advanced
 * sub-state, and the three painted tilemap cells.
 */

import {
  GAME_SUBSTATE,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw2UpLabel } from "./draw2UpLabel.js";


export function armTwoPlayerBoardSetup(m) {
  const { mem8 } = m;

  mem8[PALETTE_BANK_BIT0] = 0x00;
  mem8[PALETTE_BANK_BIT1] = 0x00;

  enqueueTask(m, 0x03, 0x02);
  enqueueTask(m, 0x02, 0x01);

  mem8[GAME_SUBSTATE] = 0x05;

  return draw2UpLabel(m);
}
