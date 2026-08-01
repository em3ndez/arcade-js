// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterCreditScreen — accept the inserted credit and set up the credit / start-select
 * screen, then advance to the wait-for-start sub-state.  ROM 0x08BA.
 *
 * This is arm 0 of the credited-state (GAME_STATE == 2) sub-state dispatch table at
 * ROM 0x08B2 (dispatchCreditedSubstate). It runs on the FIRST credited frame — the
 * instant a coin has been accepted — as the one-shot setup for the "PUSH START"
 * screen, and it advances the sub-state so that from the next frame on the per-frame
 * wait-for-start handler (loc_08F8) takes over. Its steps, in order:
 *
 *   1. Blank the playfield tilemap + zero the sprite shadow buffer
 *      (clearPlayfieldAndSprites) before the new screen is composed.
 *   2. Clear ATTRACT (0x6007 = 0) — this is the byte that marks "a credit was
 *      accepted", so this is the frame the machine leaves attract mode.
 *   3. Post the credit-screen text task [opcode 0x03, arg 0x0C] onto the task ring
 *      (enqueueTask); opcode 0x03 is the screen-text handler.
 *   4. Advance the credited sub-state GAME_SUBSTATE (0x600A) 0 -> 1 (`inc (hl)`),
 *      so subsequent frames dispatch loc_08F8 (wait on the start button) instead.
 *   5. Post the fixed batch of further screen-composition text tasks
 *      (enqueueTaskBatch) — the rest of the credit screen's strings.
 *   6. Select palette bank 0 for the credit screen: zero both bits of the 2-bit
 *      palette-bank latch (0x7D86 = 0, 0x7D87 = 0). (loc_0C92 instead sets 0x7D87 = 1;
 *      here both are 0.)
 *   7. Fall through into readStartButtonSelector (loc_08D5): read the start button
 *      and, once every 8 frames, redraw the prompt + CREDIT line.
 *
 * NOT a leaf. Reads/writes ATTRACT + GAME_SUBSTATE; the callees write the task ring,
 * the tilemap/sprite buffer, and (on draw frames) VRAM. The palette-bank stores hit
 * an I/O latch, not work RAM.
 *
 * Memory-equivalent to the frozen oracle — equivalence-08ba.test.js.
 * GATE:     crafted-entry — a real captured credited-state dispatch (drive a coin;
 *           0x08BA fires once per credit episode, since it advances the sub-state off
 *           itself) covers the natural composition path. The callee arms attract never
 *           reaches — readStartButtonSelector's CREDITS!=1 mask arm and its draw frame,
 *           and enqueueTask's ring-WRAP and full-ring DROP arms — are crafted, poked
 *           identically on both sides. Reached only after a coin (GAME_STATE == 2).
 * LIVE-OUT: memory-only — ATTRACT, GAME_SUBSTATE, the task ring, the tilemap/sprite
 *           buffer, and any draw-frame VRAM. The sole consumer of the return is
 *           dispatchCreditedSubstate (0x08B2), which discards the arm's return value
 *           (documented in its own header), so pc/SP are the dropped stack model — the
 *           oracle's push16/call/ret net to one caller-return pop, supplied by the test
 *           harness's single m.ret(). RESIDUAL ABI: the fall-through leaves A = IN2 & B
 *           (readStartButtonSelector's live-out, which loc_08F8's separate caller reads
 *           but this level's caller does not); noted for the honest-signature capstone.
 * NAMES:    ATTRACT (0x6007), GAME_SUBSTATE (0x600A) from ram.js. Hex-kept: 0x030C =
 *           the credit-screen text task message (D = opcode 0x03, E = arg 0x0C), and
 *           0x7D86/0x7D87 = the 2-bit palette-bank I/O latch (not work RAM). Imports
 *           the idiomatic callees for ROM 0x0874 / 0x309F / 0x0965 / 0x08D5.
 */

import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js"; // ROM 0x0874
import { enqueueTask } from "./enqueueTask.js"; //                            ROM 0x309F
import { enqueueTaskBatch } from "./enqueueTaskBatch.js"; //                  ROM 0x0965
import { readStartButtonSelector } from "./readStartButtonSelector.js"; //    ROM 0x08D5
import { ATTRACT, GAME_SUBSTATE } from "./ram.js";

// enqueueTask message for the credit-screen text: D = opcode 0x03 (screen-text
// handler), E = arg 0x0C (which string). The pair travels in the Z80 D/E register
// pair — enqueueTask's ABI — so it is marshalled through regs.de below.
const CREDIT_SCREEN_TASK = 0x030c;

// The 2-bit palette-bank output latch (0x7D86 = low bit, 0x7D87 = high bit). An I/O
// latch, not work RAM, so kept hex like FLIPSCREEN. Zeroing both selects bank 0.
const PALETTE_BANK_LATCH = 0x7d86;

export function enterCreditScreen(m) {
  const { regs, mem } = m;

  // 1. Blank the playfield + sprite shadow buffer before the credit screen is built.
  clearPlayfieldAndSprites(m); // ROM 0x0874

  // 2. Mark the credit accepted: leave attract mode.
  mem.write8(ATTRACT, 0);

  // 3. Post the credit-screen text task [opcode 0x03, arg 0x0C].
  regs.de = CREDIT_SCREEN_TASK;
  enqueueTask(m); // ROM 0x309F

  // 4. Advance the credited sub-state 0 -> 1 (next frame waits on the start button).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 5. Post the fixed batch of further screen-composition text tasks.
  enqueueTaskBatch(m); // ROM 0x0965

  // 6. Select palette bank 0 for the credit screen: both latch bits 0.
  mem.write8(PALETTE_BANK_LATCH, 0); //     0x7D86 = 0
  mem.write8(PALETTE_BANK_LATCH + 1, 0); // 0x7D87 = 0 (NOT 1 — cf. loc_0C92)

  // 7. Fall through into the per-frame start-button read (redraws the prompt every
  //    8th frame). Its returned A = IN2 & B is dead to this level's caller.
  readStartButtonSelector(m); // ROM 0x08D5
}
