// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildBoard — build a board: wipe the playfield, arm the palette bank and the opening
 * task, then dispatch to the per-board setup arm selected by BOARD.  ROM 0x0C92.
 *
 * Runs during board setup, from inside the vblank service. It does a fixed prologue and
 * then a data-dependent dispatch:
 *
 *   1. Clear the tilemap playfield and the sprite shadow buffer for the fresh board.
 *   2. Reset the on-screen bonus readout BONUS_DISPLAY (0x638C) to 0 — every board build
 *      starts that counter's display cell from zero before the board's own setup seeds it.
 *   3. Post the opening deferred task (opcode 5, argument 1) onto the work queue.
 *   4. Select palette bank 2 for the build — clear bit0, set bit1 of the two-bit
 *      hardware palette-bank latch. The display reads that bank to pick its colour set.
 *   5. Read BOARD and hand off to the matching per-board setup arm: 25m girders,
 *      50m conveyors, or 75m elevators. Any other value (in play, board 4) falls into
 *      the inline 100m-rivet arm, which clears the sprite rows, raises palette bit0 to
 *      reach bank 3, queues the rivet background tune, points at the rivet layout
 *      table, and runs the same shared draw/setup tail the other arms converge on.
 *
 * Every arm's eventual return is this routine's return; its caller consumes no value.
 *
 * Promoted from loc_0c92 (DK understanding pass 10, independent proposer≠confirmer, HIGH):
 * mechanisms.md §4 names this the board-build arm-dispatch (on BOARD) before the shared draw
 * tail loc_0cc6; every arm is English-named (setup25mGirderBoard / setup50mConveyorBoard /
 * setUp75mBoard / stampRivetBoardBands→loc_0cc6) and the dispatch key is the rated BOARD.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0c92.test.js.
 * GATE:     crafted-entry — attract only ever builds the 25m board, so board 1 is a
 *           real captured attract dispatch; the 50m/75m/100m arms are reached by an
 *           identical-both-sides board poke (GAME_STATE=3, GAME_SUBSTATE=0x0A,
 *           SUBSTATE_TIMER=1, BOARD=2/3/4) that forces the real dispatch. Compared on
 *           RAM − STACK_SCRATCH PLUS the palette-bank output latch. Teeth: a dropped
 *           palette-bank write, a mis-routed board arm, and the wrong rivet tune.
 * LIVE-OUT: memory-only for the RAM contract (BONUS_DISPLAY, the enqueued task, SND_BGM
 *           on the taken arm, and everything the arm + shared tail draw), PLUS the
 *           palette-bank output latch (an I/O device register the display reads, not part
 *           of the RAM dump). The caller reads no return value; DE is set only as a
 *           live-IN to enqueueTask and to the shared tail, not a live-out. SP/pc are the
 *           dropped stack model — the oracle's push16/call/ret becomes the JS call stack.
 * NAMES:    BOARD (0x6227), SND_BGM (0x6089), BONUS_DISPLAY (0x638C) from ram.js — the
 *           per-board reset of that bonus readout cell is one of the corroborations behind
 *           its name. The palette-bank latches (0x7D86/0x7D87) are the
 *           0x7Dxx hardware output region, not work RAM, so they keep their hex address;
 *           the opening-task pair (0x0501) and the rivet layout table (0x3C8B) are ROM
 *           immediates. Callees clearPlayfieldAndSprites, enqueueTask, setup25mGirderBoard,
 *           setup50mConveyorBoard, setUp75mBoard, stampRivetBoardBands, and loc_0cc6 are
 *           imported and called directly.
 */

import { BOARD, SND_BGM, BONUS_DISPLAY } from "./ram.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js"; // ROM 0x0874
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F
import { setup25mGirderBoard } from "./setup25mGirderBoard.js"; // ROM 0x0CD4
import { setup50mConveyorBoard } from "./setup50mConveyorBoard.js"; // ROM 0x0CDF
import { setUp75mBoard } from "./setUp75mBoard.js"; // ROM 0x0CF2
import { stampRivetBoardBands } from "./stampRivetBoardBands.js"; // ROM 0x0D43
import { loc_0cc6 } from "./loc_0cc6.js"; // ROM 0x0CC6

// The two-bit palette-bank select latch (ls259.6h): a board control OUTPUT the display
// reads to pick its colour set, not work RAM, so it keeps its hex address. 0x7D86 is
// bit0, 0x7D87 is bit1; together they select bank 0..3.
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

// The opening deferred task posted for every board build: opcode 0x05, argument 0x01,
// packed as the message pair enqueueTask reads from the register image.
const OPENING_TASK = 0x0501;

// The 100m-rivet layout table in ROM, handed to the shared tail through the register image.
const LAYOUT_TABLE_RIVET = 0x3c8b;

export function buildBoard(m) {
  const { regs, mem } = m;

  // Wipe the playfield tilemap and the sprite shadow buffer for the fresh board.
  clearPlayfieldAndSprites(m);

  // Reset the on-screen bonus readout for the fresh board.
  mem.write8(BONUS_DISPLAY, 0);

  // Post the opening task onto the deferred-work queue.
  regs.de = OPENING_TASK; // enqueueTask reads the message pair from the register image
  enqueueTask(m);

  // Select palette bank 2 for the build: bit0 clear, bit1 set.
  mem.write8(PALETTE_BANK_BIT0, 0);
  mem.write8(PALETTE_BANK_BIT1, 1);

  // Dispatch to the per-board setup arm selected by BOARD.
  const board = mem.read8(BOARD);
  if (board === 1) { setup25mGirderBoard(m); return; }   // 25m girders
  if (board === 2) { setup50mConveyorBoard(m); return; } // 50m conveyors
  if (board === 3) { setUp75mBoard(m); return; }         // 75m elevators

  // 100m-rivet arm — BOARD == 4 (and any other value, matching the decrement cascade).
  // Clear the sprite rows, raise palette bit0 to reach bank 3, queue the rivet tune,
  // and hand the rivet layout table to the shared draw/setup tail.
  stampRivetBoardBands(m);
  mem.write8(PALETTE_BANK_BIT0, 1);
  mem.write8(SND_BGM, 0x0b);
  regs.de = LAYOUT_TABLE_RIVET; // loc_0cc6 -> drawBoardLayout walks the DE-selected table
  loc_0cc6(m);
}
