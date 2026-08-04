// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e6d — stamp Mario's sprite facing on the board-won path, then commit the board
 * advance and unwind out of the movement cascade.
 *
 * A shared interior of Mario's per-frame position check, reached on the rescue win condition
 * — Mario has climbed to the rescue row near Pauline — of every non-rivet board. The odd
 * boards (25m, 75m) arrive with the carry SET; board 2 arrives with it clear. (Board 4 is
 * diverted to the rivet arm earlier and never reaches here.) The caller hands over that
 * single selector, the carry flag, and this routine sets Mario's sprite-record code byte to
 * a bare facing value:
 *   • carry SET   -> 0x00  (horizontal-flip bit clear)
 *   • carry CLEAR -> 0x80  (horizontal-flip / facing bit set)
 * so the whole tile-code byte becomes just that flip bit — the sprite mirror flag.
 *
 * It then commits the win: the board-advance step stamps the board-cleared / advance
 * sub-state into GAME_SUBSTATE and UNWINDS out of the movement cascade, aborting any further
 * movement on the frame the board is won. This routine returns that step's unwind signal
 * unchanged — false, the caller-skip value meaning "abort: do not continue".
 *
 * The carry is a genuine register live-in: the callers leave the selector in the machine
 * flag, so this routine reads it from there rather than taking a parameter.
 *
 * LIVE-OUT: Mario's sprite-record code byte, and GAME_SUBSTATE (written by the board-advance
 * step), plus the unwind signal — always false.
 */

import { MARIO_SPRITE_RECORD, SPRITE_CODE } from "./names.js";
import { enterBoardAdvanceAndUnwind } from "./enterBoardAdvanceAndUnwind.js";

export function loc_1e6d(m) {
  const { regs, mem } = m;

  // Set Mario's sprite-record code byte to just the facing bit the caller selected:
  // carry set -> flip clear (0x00), carry clear -> flip set (0x80).
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_CODE, regs.fC ? 0x00 : 0x80);

  // The board is won -> enter the board-advance sub-state and unwind out of the movement
  // cascade. Propagate the callee's unwind signal (false = abort, do not continue).
  return enterBoardAdvanceAndUnwind(m);
}
