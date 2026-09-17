// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildBoard — build a board: wipe the playfield, reset the bonus readout, post the opening task,
 * select palette bank 2, then dispatch to the per-board setup arm selected by BOARD (1 = 25m
 * girders, 2 = 50m conveyors, 3 = 75m elevators). Any other value falls into the inline 100m-rivet
 * arm, which stamps the rivet bands, raises palette bit0 to bank 3, queues the rivet tune, and runs
 * the shared draw/setup tail.
 *
 * LIVE-OUT: memory (BONUS_DISPLAY, the enqueued task, SND_BGM on the taken arm, and everything the
 * arm and shared tail draw) plus the palette-bank output latch.
 */

import { BOARD, SND_BGM, BONUS_DISPLAY } from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";
import { setup25mGirderBoard } from "./setup25mGirderBoard.js";
import { setup50mConveyorBoard } from "./setup50mConveyorBoard.js";
import { setUp75mBoard } from "./setUp75mBoard.js";
import { stampRivetBoardBands } from "./stampRivetBoardBands.js";
import { loc_0cc6 } from "./loc_0cc6.js";

// Two-bit palette-bank select latch: board control outputs, not work RAM (bit0, then bit1).
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

const OPENING_TASK = 0x0501; // opcode 0x05, argument 0x01, packed for the task-ring primitive
const LAYOUT_TABLE_RIVET = 0x3c8b;

export function buildBoard(m) {
  const { regs, mem, mem8 } = m;

  clearPlayfieldAndSprites(m);

  mem8[BONUS_DISPLAY] = 0;

  regs.de = OPENING_TASK;
  enqueueTask(m);

  // Select palette bank 2: bit0 clear, bit1 set.
  mem.write8(PALETTE_BANK_BIT0, 0);
  mem.write8(PALETTE_BANK_BIT1, 1);

  const board = mem8[BOARD];
  if (board === 1) { setup25mGirderBoard(m); return; }
  if (board === 2) { setup50mConveyorBoard(m); return; }
  if (board === 3) { setUp75mBoard(m); return; }

  // 100m-rivet arm (BOARD == 4 and any other value): stamp the bands, raise palette bit0 to
  // bank 3, queue the rivet tune, and hand the rivet layout table to the shared tail.
  stampRivetBoardBands(m);
  mem.write8(PALETTE_BANK_BIT0, 1);
  mem8[SND_BGM] = 0x0b;
  regs.de = LAYOUT_TABLE_RIVET;
  loc_0cc6(m);
}
