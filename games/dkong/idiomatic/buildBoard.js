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

import {
  BOARD,
  BOARD_LAYOUT_TABLE_RIVET,
  BOARD_OPENING_TASK,
  BONUS_DISPLAY,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  SND_BGM,
} from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";
import { setup25mGirderBoard } from "./setup25mGirderBoard.js";
import { setup50mConveyorBoard } from "./setup50mConveyorBoard.js";
import { setUp75mBoard } from "./setUp75mBoard.js";
import { stampRivetBoardBands } from "./stampRivetBoardBands.js";
import { loc_0cc6 } from "./loc_0cc6.js";

// Two-bit palette-bank select latch: board control outputs, not work RAM (bit0, then bit1).


export function buildBoard(m) {
  const { mem8 } = m;

  clearPlayfieldAndSprites(m);

  mem8[BONUS_DISPLAY] = 0;

  enqueueTask(m, BOARD_OPENING_TASK >> 8, BOARD_OPENING_TASK & 0xff);

  // Select palette bank 2: bit0 clear, bit1 set.
  mem8[PALETTE_BANK_BIT0] = 0;
  mem8[PALETTE_BANK_BIT1] = 1;

  const board = mem8[BOARD];
  if (board === 1) { setup25mGirderBoard(m); return; }
  if (board === 2) { setup50mConveyorBoard(m); return; }
  if (board === 3) { setUp75mBoard(m); return; }

  // 100m-rivet arm (BOARD == 4 and any other value): stamp the bands, raise palette bit0 to
  // bank 3, queue the rivet tune, and hand the rivet layout table to the shared tail.
  stampRivetBoardBands(m);
  mem8[PALETTE_BANK_BIT0] = 1;
  mem8[SND_BGM] = 0x0b;
  // Re-seat: the shared board-layout tail reads the layout-table pointer from the bridge.
  m.regs.de = BOARD_LAYOUT_TABLE_RIVET;
  loc_0cc6(m);
}
