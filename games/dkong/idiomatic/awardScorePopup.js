// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardScorePopup — award points and stage the floating score glyph over Mario.
 *
 * The "you scored" effect. It is entered with a MATCHED PAIR already chosen: an award-table index
 * and the glyph tile that depicts the same amount. The two move together — a bigger award always
 * brings the bigger number sprite — which is what makes this a score POPUP rather than a bare
 * award. Three acts:
 *
 *   1. POST THE AWARD. Enqueue a task carrying the opcode/index pair, so the score is credited
 *      later off the task ring rather than here.
 *   2. STAGE THE GLYPH. Write a four-byte hardware sprite record into a fixed slot of the sprite
 *      buffer: X = Mario's X, code = the glyph tile, attribute = the popup colour, Y = Mario's Y
 *      plus a fixed offset. The field order X, code, attribute, Y is the standard sprite-record
 *      layout, so the number appears just below Mario, at his own column.
 *   3. PING THE SOUND, on some boards only. The board gate is consulted with a mask selecting 25m
 *      and 75m: on those two the award sound latch is asserted for three frames, on the other two
 *      the gate is closed and the routine returns silent.
 *
 * LIVE-OUT: memory-only — the task ring and its tail, the four sprite bytes, and (on the sound arm
 * only) the award sound latch.
 */

import { MARIO_X, MARIO_Y, SPRITE_BUFFER, SND_TRIGGER } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { boardBitGate } from "./boardBitGate.js";

const POPUP_SPRITE = SPRITE_BUFFER + 0x130; // the score-glyph sprite record (record 76)
const POPUP_Y_OFFSET = 0x14;                // how far below Mario the glyph sits, in pixels
const SOUND_BOARD_MASK = 0x05;              // bit0 = 25m, bit2 = 75m — boards that play the sound
const AWARD_SOUND = SND_TRIGGER + 5;        // the score-award sound trigger
const SND_ASSERT_FRAMES = 3;                // a 3-frame assert
const SPRITE_ATTR = 0x07;                   // the glyph sprite's colour/attribute byte

export function awardScorePopup(m) {
  const { regs, mem } = m;

  // (1) Post the score-award task. The opcode/index pair is already in place, so the ring
  // primitive picks it up as-is.
  enqueueTask(m);

  // (2) Stage the floating score glyph as a sprite record at Mario's column.
  const popupY = (mem.read8(MARIO_Y) + POPUP_Y_OFFSET) & 0xff;
  mem.write8(POPUP_SPRITE + 0, mem.read8(MARIO_X)); // X = Mario's X
  mem.write8(POPUP_SPRITE + 1, regs.b);             // tile code = the points glyph
  mem.write8(POPUP_SPRITE + 2, SPRITE_ATTR);        // colour/attribute
  mem.write8(POPUP_SPRITE + 3, popupY);             // Y = just below Mario

  // (3) On boards whose bit is set in the mask (25m and 75m), ping the award sound. The gate
  // reads the mask from the accumulator; a closed gate returns without the sound.
  regs.a = SOUND_BOARD_MASK;
  if (!boardBitGate(m)) return;
  mem.write8(AWARD_SOUND, SND_ASSERT_FRAMES);
}
