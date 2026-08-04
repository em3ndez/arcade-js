// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterCreditScreen — accept the inserted credit and set up the credit / start-select
 * screen, then advance to the wait-for-start sub-state.
 *
 * The first credited frame — the instant a coin has been accepted — and the one-shot
 * setup for the "PUSH START" screen. It also steps the sub-state on, so from the next
 * frame the per-frame wait-for-start handler takes over and this never runs again for
 * the same credit. Its steps, in order:
 *
 *   1. Blank the playfield tilemap and zero the sprite shadow buffer before the new
 *      screen is composed.
 *   2. Clear ATTRACT. That byte is what marks "a credit was accepted", so this is the
 *      frame the machine leaves attract mode.
 *   3. Post the credit-screen text task onto the deferred-task ring: the screen-text
 *      opcode, with the string selector as its argument.
 *   4. Advance GAME_SUBSTATE from 0 to 1, so subsequent frames wait on the start
 *      button instead of re-running this setup.
 *   5. Post the fixed batch of further screen-composition text tasks — the rest of the
 *      credit screen's strings.
 *   6. Select palette bank 0 for the credit screen by zeroing both bits of the two-bit
 *      palette-bank latch.
 *   7. Fall through into the start-button read, which polls the button and, once every
 *      eight frames, redraws the prompt and the CREDIT line.
 *
 * NOT a leaf. It reads and writes ATTRACT and GAME_SUBSTATE itself; the callees write
 * the task ring, the tilemap and sprite buffer, and on draw frames the video RAM. The
 * palette-bank stores go to an output latch, not to work RAM.
 *
 * LIVE-OUT: memory-only — ATTRACT, GAME_SUBSTATE, the task ring, the tilemap and sprite
 * buffer, and any draw-frame video RAM. The start-button read leaves a button result
 * behind; the caller at this level does not consume it.
 */

import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";
import { enqueueTaskBatch } from "./enqueueTaskBatch.js";
import { readStartButtonSelector } from "./readStartButtonSelector.js";
import { ATTRACT, GAME_SUBSTATE } from "./names.js";

// The credit-screen text message: the screen-text opcode in the high byte, the string
// selector in the low one. It reaches the post primitive through the register image.
const CREDIT_SCREEN_TASK = 0x030c;

// The two-bit palette-bank output latch — this cell is the low bit and the next one the
// high bit. An output latch, not work RAM. Zeroing both selects bank 0.
const PALETTE_BANK_LATCH = 0x7d86;

export function enterCreditScreen(m) {
  const { regs, mem } = m;

  // 1. Blank the playfield + sprite shadow buffer before the credit screen is built.
  clearPlayfieldAndSprites(m);

  // 2. Mark the credit accepted: leave attract mode.
  mem.write8(ATTRACT, 0);

  // 3. Post the credit-screen text task.
  regs.de = CREDIT_SCREEN_TASK;
  enqueueTask(m);

  // 4. Advance the credited sub-state 0 -> 1 (next frame waits on the start button).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 5. Post the fixed batch of further screen-composition text tasks.
  enqueueTaskBatch(m);

  // 6. Select palette bank 0 for the credit screen: both latch bits 0.
  mem.write8(PALETTE_BANK_LATCH, 0); //     low bit
  mem.write8(PALETTE_BANK_LATCH + 1, 0); // high bit — zero here, not one

  // 7. Fall through into the per-frame start-button read (redraws the prompt every
  //    8th frame). The button result it leaves behind is dead to this level's caller.
  readStartButtonSelector(m);
}
