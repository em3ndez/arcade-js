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
// Imported in faithful-translation form ON PURPOSE: this tail is a fall-through, so the
// painter's own return must return from here — the idiomatic twin would swallow it.
import { loc_09ee } from "../translated/loc_09ee.js";


export function armTwoPlayerBoardSetup(m) {
  const { regs, mem, mem8 } = m;

  mem.write8(PALETTE_BANK_BIT0, 0x00);
  mem.write8(PALETTE_BANK_BIT1, 0x00);

  regs.de = 0x0302;
  enqueueTask(m);
  regs.de = 0x0201;
  enqueueTask(m);

  mem8[GAME_SUBSTATE] = 0x05;

  return loc_09ee(m);
}
