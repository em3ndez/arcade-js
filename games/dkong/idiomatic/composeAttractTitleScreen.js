// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeAttractTitleScreen — build the attract title/score screen and hand off to the next
 * attract step.
 *
 * LIVE-OUT: memory-only — the task ring and its tail, SUBSTATE_TIMER, GAME_SUBSTATE, the blanked
 * playfield and sprite buffer, the 1UP/2UP label cells, and the coinage digit cells.
 */

import {
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
  TWO_PLAYER_GAME,
  DIP_COINS_FOR_1P,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { enqueueTaskBatch } from "./enqueueTaskBatch.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { draw1UpLabel } from "./draw1UpLabel.js";
import { draw2UpLabel } from "./draw2UpLabel.js";
import { writeDigitPairWithCarry } from "./writeDigitPairWithCarry.js";

// Write-only palette-bank select latches.
const PALETTE_BANK_LATCH_LO = 0x7d86;
const PALETTE_BANK_LATCH_HI = 0x7d87;

const DRAW_STRING = 0x03;
const TITLE_STRING_A = 0x1b;
const TITLE_STRING_B = 0x1c;

const COINAGE_DIGIT_CELL = 0x756c;

export function composeAttractTitleScreen(m) {
  const { regs, mem, mem8, mem16 } = m;

  mem.write8(PALETTE_BANK_LATCH_LO, 0x00);
  mem.write8(PALETTE_BANK_LATCH_HI, 0x00);

  regs.d = DRAW_STRING;
  regs.e = TITLE_STRING_A;
  enqueueTask(m);
  regs.e = TITLE_STRING_B;
  enqueueTask(m);
  enqueueTaskBatch(m);

  mem8[SUBSTATE_TIMER] = 0x02;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);

  clearPlayfieldAndSprites(m);
  draw1UpLabel(m);
  if (mem8[TWO_PLAYER_GAME] === 0x01) draw2UpLabel(m);

  // Pass 1 stamps the coinage digits; its tail leaves the inputs pass 2 consumes for the "1 2".
  regs.de = mem16[DIP_COINS_FOR_1P];
  regs.hl = COINAGE_DIGIT_CELL;
  writeDigitPairWithCarry(m);
  writeDigitPairWithCarry(m);
}
