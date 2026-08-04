// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeAttractTitleScreen — build the attract title/score screen and hand off to the next
 * attract step.
 *
 * This is the first attract sub-state: the title screen showing the "1UP / HIGH SCORE / 2UP" score
 * row and the coins-per-credit readout. It composes that screen once, then arms a 2-frame timer
 * and steps the sub-state on, so the next frame moves attract along. In order:
 *
 *   1. Clear both palette-bank select latches, which selects palette bank 0.
 *   2. Post the two attract title strings straight onto the task ring — the draw-string opcode
 *      with one string id and then the other — followed by the fixed title-screen task batch.
 *   3. Arm SUBSTATE_TIMER to 2 and advance GAME_SUBSTATE by one: the "wait two frames then
 *      proceed" idiom that walks attract to its next sub-state.
 *   4. Blank the playfield and the sprite buffer, then draw the "1UP" score label — and the "2UP"
 *      label only in a two-player game.
 *   5. Draw the coins-per-credit readout from the two coinage settings.
 *
 * THE DIGIT WRITER RUNS TWICE, and the second run is not a copy-paste. The first pass stamps the
 * coinage digits from the settings at the coinage cell; that pass's own tail then leaves the
 * inputs the second pass consumes, which stamp the literal "1 2" further down the screen. There is
 * no counter: it is a two-iteration loop written as a call that falls through into itself.
 *
 * The task post and the digit writer both take their inputs in registers, so those are staged
 * before each call.
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

// Write-only palette-bank select latches, cleared to select bank 0.
const PALETTE_BANK_LATCH_LO = 0x7d86;
const PALETTE_BANK_LATCH_HI = 0x7d87;

// Task-ring message payloads: the draw-string opcode, and the two attract title-string ids this
// handler posts ahead of the fixed batch.
const DRAW_STRING = 0x03;
const TITLE_STRING_A = 0x1b;
const TITLE_STRING_B = 0x1c;

// The tilemap cell holding the 1-player coins-per-credit digit. The digit writer places the
// 2-player digit two columns along, and on a value of ten it also writes a tens digit.
const COINAGE_DIGIT_CELL = 0x756c;

export function composeAttractTitleScreen(m) {
  const { regs, mem } = m;

  // 1. Select palette bank 0 by clearing both bank-select latches.
  mem.write8(PALETTE_BANK_LATCH_LO, 0x00);
  mem.write8(PALETTE_BANK_LATCH_HI, 0x00);

  // 2. Post the two title strings directly, then the fixed title-screen task batch. The post
  //    reads the opcode and the argument out of a register pair and never writes them back, so
  //    holding the opcode while stepping the argument is safe.
  regs.d = DRAW_STRING;
  regs.e = TITLE_STRING_A;
  enqueueTask(m);
  regs.e = TITLE_STRING_B;
  enqueueTask(m);
  enqueueTaskBatch(m);

  // 3. Wait 2 frames, then advance to the next attract sub-state.
  mem.write8(SUBSTATE_TIMER, 0x02);
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 4. Blank the screen, then draw the score labels (2UP only in a 2-player game).
  clearPlayfieldAndSprites(m);
  draw1UpLabel(m);
  if (mem.read8(TWO_PLAYER_GAME) === 0x01) draw2UpLabel(m);

  // 5. Draw the coins-per-credit readout. Pass 1 stamps the coinage digits from the two settings
  //    at the coinage cell; its own tail then leaves the inputs the SECOND pass consumes to stamp
  //    the literal "1 2" further down.
  regs.de = mem.read16(DIP_COINS_FOR_1P); // the 1-player setting and, beside it, the 2-player one
  regs.hl = COINAGE_DIGIT_CELL;
  writeDigitPairWithCarry(m);
  writeDigitPairWithCarry(m);
}
