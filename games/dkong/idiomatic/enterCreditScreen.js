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
import { ATTRACT, GAME_SUBSTATE } from "./names.js";

const CREDIT_SCREEN_TASK = 0x030c; // screen-text opcode high, string selector low

const PALETTE_BANK_LATCH = 0x7d86; // two-bit output latch; this cell low bit, next high bit

export function enterCreditScreen(m) {
  const { regs, mem, mem8 } = m;

  clearPlayfieldAndSprites(m);

  mem8[ATTRACT] = 0;

  regs.de = CREDIT_SCREEN_TASK;
  enqueueTask(m);

  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1) & 0xff;

  enqueueTaskBatch(m);

  // Select palette bank 0: both latch bits 0 (device latch, kept as mem.write8).
  mem.write8(PALETTE_BANK_LATCH, 0);
  mem.write8(PALETTE_BANK_LATCH + 1, 0);

  // Fall through into the per-frame start-button read.
  readStartButtonSelector(m);
}
