// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextBoard — move the board order on to the next board and go into the
 * "HOW HIGH CAN YOU GET?" interlude that introduces it.
 *
 * The last step of the sequence that runs after a board is cleared. It first ticks the shared
 * sub-state countdown, and while that is still running the routine does nothing at all; only on
 * the frame the countdown expires does the advance actually happen.
 *
 * On that frame it walks BOARD_SEQ_PTR one entry forward through the board-order table and reads
 * the board waiting there. The table ends in a terminator byte; reaching it puts the pointer back
 * to the start of the repeating group rather than stopping, which is how the game keeps handing
 * out boards forever once a player is past the fixed opening order. Whichever board comes out is
 * published to BOARD.
 *
 * It then posts a deferred task, clears the sequence step counter so the next board-cleared run
 * starts from its own first step, and arms the following sub-state: a 48-frame wait, and then the
 * how-high interlude for the board just selected.
 *
 * LIVE-OUT: memory-only — the board-order pointer, the current board, the posted task, the
 * cleared sequence step, the armed countdown and the next sub-state.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { enqueueTask } from "./enqueueTask.js";
import { BOARD_SEQ_PTR, BOARD, SUBSTATE_TIMER, GAME_SUBSTATE, BOARD_ADVANCE_STEP } from "./names.js";

/** Where the board order restarts when it runs off the end of the table. */
const SEQ_TABLE_WRAP = 0x3a73;
/** The byte that marks the end of the board-order table. */
const SEQ_TERMINATOR = 0x7f;

export function advanceToNextBoard(m) {
  const { regs, mem } = m;

  // Tick the sub-state countdown; the advance runs only on the frame it expires.
  if (!tickSubstateTimer(m)) return;

  // Walk the board-order pointer on one entry and read the board there; at the terminator
  // put the pointer back to the start of the repeating group so the order never runs out.
  let ptr = (mem.read16(BOARD_SEQ_PTR) + 1) & 0xffff;
  let board = mem.read8(ptr);
  if (board === SEQ_TERMINATOR) {
    ptr = SEQ_TABLE_WRAP;
    board = mem.read8(ptr);
  }
  mem.write16(BOARD_SEQ_PTR, ptr);
  mem.write8(BOARD, board);

  // Post the deferred task: opcode 5, no argument.
  regs.d = 0x05;
  regs.e = 0x00;
  enqueueTask(m);

  // Clear the sequence step counter, then arm the next sub-state: wait 48 frames, then
  // the how-high interlude for the board just selected.
  mem.write8(BOARD_ADVANCE_STEP, 0x00);
  mem.write8(SUBSTATE_TIMER, 0x30);
  mem.write8(GAME_SUBSTATE, 0x08);
}
