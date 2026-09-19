// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextBoard — move the board order on to the next board and enter the "HOW HIGH CAN YOU
 * GET?" interlude that introduces it. Runs only on the frame the sub-state countdown expires.
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { enqueueTask } from "./enqueueTask.js";
import { BOARD_SEQ_PTR, BOARD, SUBSTATE_TIMER, GAME_SUBSTATE, BOARD_ADVANCE_STEP } from "./names.js";

const SEQ_TABLE_WRAP = 0x3a73; // where the board order restarts at the table's end
const SEQ_TERMINATOR = 0x7f;

export function advanceToNextBoard(m) {
  const { mem8, mem16 } = m;

  if (!tickSubstateTimer(m)) return;

  // Walk the pointer on one entry; at the terminator wrap to the repeating group so it never ends.
  let ptr = u16(mem16[BOARD_SEQ_PTR] + 1);
  let board = mem8[ptr];
  if (board === SEQ_TERMINATOR) {
    ptr = SEQ_TABLE_WRAP;
    board = mem8[ptr];
  }
  mem16[BOARD_SEQ_PTR] = ptr;
  mem8[BOARD] = board;

  enqueueTask(m, 0x05, 0x00);

  mem8[BOARD_ADVANCE_STEP] = 0x00;
  mem8[SUBSTATE_TIMER] = 0x30;
  mem8[GAME_SUBSTATE] = 0x08;
}
