// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildBoard — build a board: wipe the playfield, arm the palette bank and the opening
 * task, then dispatch to the per-board setup arm selected by BOARD.
 *
 * Runs during board setup, from inside the vblank service. It does a fixed prologue and
 * then a data-dependent dispatch:
 *
 *   1. Clear the tilemap playfield and the sprite shadow buffer for the fresh board.
 *   2. Reset the on-screen bonus readout BONUS_DISPLAY to 0 — every board build starts
 *      that counter's display cell from zero before the board's own setup seeds it.
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
 * LIVE-OUT: memory (BONUS_DISPLAY, the enqueued task, SND_BGM on the taken arm, and
 * everything the arm and the shared tail draw), PLUS the palette-bank output latch — a
 * device register the display reads rather than a RAM cell.
 */

import { BOARD, SND_BGM, BONUS_DISPLAY } from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";
import { setup25mGirderBoard } from "./setup25mGirderBoard.js";
import { setup50mConveyorBoard } from "./setup50mConveyorBoard.js";
import { setUp75mBoard } from "./setUp75mBoard.js";
import { stampRivetBoardBands } from "./stampRivetBoardBands.js";
import { loc_0cc6 } from "./loc_0cc6.js";

// The two-bit palette-bank select latch: a board control OUTPUT the display reads to pick
// its colour set, not work RAM. The first address is bit0 and the second bit1; together
// they select bank 0..3.
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

// The opening deferred task posted for every board build: opcode 0x05, argument 0x01,
// packed as the message pair the task-ring primitive reads from the register image.
const OPENING_TASK = 0x0501;

// The 100m-rivet layout table, handed to the shared tail through the register image.
const LAYOUT_TABLE_RIVET = 0x3c8b;

export function buildBoard(m) {
  const { regs, mem } = m;

  // Wipe the playfield tilemap and the sprite shadow buffer for the fresh board.
  clearPlayfieldAndSprites(m);

  // Reset the on-screen bonus readout for the fresh board.
  mem.write8(BONUS_DISPLAY, 0);

  // Post the opening task onto the deferred-work queue.
  regs.de = OPENING_TASK; // the task-ring primitive reads the message pair from the registers
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
  regs.de = LAYOUT_TABLE_RIVET; // the shared tail walks whichever layout table is selected here
  loc_0cc6(m);
}
