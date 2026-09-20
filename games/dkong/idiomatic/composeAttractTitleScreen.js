// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeAttractTitleScreen — build the attract title/score screen and hand off to the next
 * attract step.
 *
 * LIVE-OUT: memory-only — the task ring and its tail, SUBSTATE_TIMER, GAME_SUBSTATE, the blanked
 * playfield and sprite buffer, the 1UP/2UP label cells, and the coinage digit cells.
 */

import {
  DIP_COINS_FOR_1P,
  GAME_SUBSTATE,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  SUBSTATE_TIMER,
  TWO_PLAYER_GAME,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { enqueueTaskBatch } from "./enqueueTaskBatch.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { draw1UpLabel } from "./draw1UpLabel.js";
import { draw2UpLabel } from "./draw2UpLabel.js";
import { writeDigitPairWithCarry } from "./writeDigitPairWithCarry.js";

// Write-only palette-bank select latches.

const DRAW_STRING = 0x03;
const TITLE_STRING_A = 0x1b;
const TITLE_STRING_B = 0x1c;

const COINAGE_DIGIT_CELL = 0x756c;

export function composeAttractTitleScreen(m) {
  const { mem8, mem16 } = m;

  mem8[PALETTE_BANK_BIT0] = 0x00;
  mem8[PALETTE_BANK_BIT1] = 0x00;

  enqueueTask(m, DRAW_STRING, TITLE_STRING_A);
  enqueueTask(m, DRAW_STRING, TITLE_STRING_B);
  enqueueTaskBatch(m);

  mem8[SUBSTATE_TIMER] = 0x02;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);

  clearPlayfieldAndSprites(m);
  draw1UpLabel(m);
  if (mem8[TWO_PLAYER_GAME] === 0x01) draw2UpLabel(m);

  // Pass 1 stamps the coinage digits; its tail leaves the inputs pass 2 consumes for the "1 2".
  // The pair is little-endian: low byte is the left/ones value, high byte the right value.
  const coinage = mem16[DIP_COINS_FOR_1P];
  writeDigitPairWithCarry(m, coinage & 0xff, (coinage >> 8) & 0xff, COINAGE_DIGIT_CELL);
  writeDigitPairWithCarry(m);
}
