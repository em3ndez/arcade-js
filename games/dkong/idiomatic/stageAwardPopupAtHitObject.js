// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAwardPopupAtHitObject — post the caller's deferred message, take the score popup's screen
 * position out of a parameter block, and hand both on to the sprite stamp.
 *
 * This is where the fixed-value award setters converge: each one loads its own popup sprite code
 * and its own deferred-task message and jumps here, so everything below happens the same way
 * whichever award was chosen. In order:
 *
 *   1. the message is posted onto the task ring, fire-and-forget — the result is not read, and
 *      both the sprite code and the message survive the post untouched;
 *   2. a pointer is loaded from EFFECT_PARAM_PTR, which addresses a small parameter block;
 *   3. the popup's X is read out of the block's first byte and that byte is then CLEARED in
 *      place — a consume-once read, so the same block cannot place a second popup. The popup's
 *      Y is read out of the block's fourth byte; that three-byte walk is 8-bit, so it stays
 *      inside the block's own page rather than crossing into the next one;
 *   4. control goes to the sprite stamp, which turns the position and the sprite code into the
 *      popup's hardware sprite record and cues the accompanying sound.
 *
 * NOT CLAIMED: what the parameter block describes. All this routine establishes about it is that
 * its first and fourth bytes are the popup's X and Y, and that reading the X consumes it.
 *
 * LIVE-OUT: memory-only — the task ring, the cleared first byte of the parameter block, and
 * whatever the sprite stamp writes. The position and sprite code are consumed inside this same
 * hand-off and are not left for a caller.
 */
import { enqueueTask } from "./enqueueTask.js";
import { stampScorePopupSprite } from "./stampScorePopupSprite.js";
import { EFFECT_PARAM_PTR } from "./names.js";

export function stageAwardPopupAtHitObject(m) {
  const { regs, mem } = m;

  // Post the caller's deferred message. The sprite code and the message survive the post.
  enqueueTask(m);

  // The parameter block's address is held indirectly, as a word.
  const block = mem.read16(EFFECT_PARAM_PTR);

  // The popup's X is the block's first byte, and reading it consumes it.
  regs.a = mem.read8(block);
  mem.write8(block, 0x00);

  // The popup's Y is the block's fourth byte. The walk is 8-bit, so the high half of the
  // address is fixed and the read stays inside the block's own page.
  regs.c = mem.read8((block & 0xff00) | ((block + 3) & 0xff));

  // Stamp the popup's sprite record and cue its sound.
  stampScorePopupSprite(m);
}
