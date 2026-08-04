// SPDX-License-Identifier: GPL-3.0-only
/**
 * setClimbSpriteFrame — stamp Mario's climb-animation sprite for one climb step, then flag him
 * on the ladder and refresh his sprite record.
 *
 * Reached from the shared climb-animation body once it has moved Mario one climb sub-step and
 * chosen this step's climb frame code. Mario's sprite code packs his horizontal-mirror flag in
 * the top bit and an animation code in the low bits. For a climb step this routine:
 *
 *   - toggles the mirror flag — the left/right leg wiggle that reads as climbing — while
 *     dropping the previous step's animation code, and
 *   - stamps in the new climb frame code the caller chose for this step. The climb codes are
 *     3, 4 and 5, cycled by how far up the ladder Mario has got.
 *
 * It then falls straight into the shared climb-step tail, which re-asserts the on-ladder flag
 * and copies Mario's freshly-computed position and sprite code into his hardware sprite record.
 * That tail is the whole chain's single exit.
 *
 * Reads: Mario's sprite code. Writes: Mario's sprite code, and through the tail his on-ladder
 * flag and the four bytes of his sprite record.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_SPRITE_CODE } from "./names.js";
import { markOnLadderAndCommitSprite } from "./markOnLadderAndCommitSprite.js";

// Bit 7 of the sprite code is Mario's horizontal-mirror flag (set = facing right).
const MIRROR_BIT = 0x80;

export function setClimbSpriteFrame(m, frame) {
  // Isolate the current mirror flag (discarding the previous animation code), flip
  // it for this step's wiggle, then combine it with the new climb frame code.
  const toggledMirror = (m.mem.read8(MARIO_SPRITE_CODE) & MIRROR_BIT) ^ MIRROR_BIT;
  m.mem.write8(MARIO_SPRITE_CODE, toggledMirror | frame);

  markOnLadderAndCommitSprite(m); // re-flag on-ladder, refresh the sprite record
}
