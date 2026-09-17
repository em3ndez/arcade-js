// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e6d — on the board-won (rescue) path, stamp Mario's sprite facing then commit the board
 * advance and unwind out of the movement cascade. Carry selects the facing bit: set -> 0x00
 * (flip clear), clear -> 0x80 (flip set). Returns the board-advance step's unwind signal,
 * always false (abort: do not continue).
 *
 * LIVE-OUT: Mario's sprite-record code byte, GAME_SUBSTATE (via the board-advance step), and the
 * unwind signal (false).
 */

import { MARIO_SPRITE_RECORD, SPRITE_CODE } from "./names.js";
import { enterBoardAdvanceAndUnwind } from "./enterBoardAdvanceAndUnwind.js";

export function loc_1e6d(m) {
  const { regs, mem8 } = m;
  mem8[MARIO_SPRITE_RECORD + SPRITE_CODE] = regs.fC ? 0x00 : 0x80;
  return enterBoardAdvanceAndUnwind(m);
}
