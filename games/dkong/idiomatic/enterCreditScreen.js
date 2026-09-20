// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterCreditScreen — accept the inserted credit and set up the credit / start-select screen,
 * then advance to the wait-for-start sub-state. Blanks the playfield and sprite buffer, clears
 * ATTRACT (leaving attract mode), posts the credit-screen text tasks, steps GAME_SUBSTATE 0->1,
 * selects palette bank 0, and falls through into the start-button read.
 *
 * LIVE-OUT: memory-only — ATTRACT, GAME_SUBSTATE, the task ring, the tilemap and sprite buffer,
 * and any draw-frame video RAM.
 */

import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";
import { enqueueTaskBatch } from "./enqueueTaskBatch.js";
import { readStartButtonSelector } from "./readStartButtonSelector.js";
import {
  ATTRACT,
  CREDIT_SCREEN_TASK,
  GAME_SUBSTATE,
  PALETTE_BANK_BIT0,
} from "./names.js";



export function enterCreditScreen(m) {
  const { regs, mem8 } = m;

  clearPlayfieldAndSprites(m);

  mem8[ATTRACT] = 0;

  regs.de = CREDIT_SCREEN_TASK;
  enqueueTask(m);

  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);

  enqueueTaskBatch(m);

  // Select palette bank 0: both latch bits 0.
  mem8[PALETTE_BANK_BIT0] = 0;
  mem8[PALETTE_BANK_BIT0 + 1] = 0;

  // Fall through into the per-frame start-button read.
  readStartButtonSelector(m);
}
