// SPDX-License-Identifier: GPL-3.0-only
/**
 * setClimbSpriteFrame — stamp Mario's climb-animation sprite for one climb step: toggle the
 * horizontal-mirror flag (the climbing leg wiggle) while dropping the previous animation code, OR
 * in the caller's new climb frame code, then fall into the shared climb-step tail that re-asserts
 * the on-ladder flag and refreshes his sprite record.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_SPRITE_CODE } from "./names.js";
import { markOnLadderAndCommitSprite } from "./markOnLadderAndCommitSprite.js";

const MIRROR_BIT = 0x80; // bit 7 of the sprite code = horizontal-mirror flag

export function setClimbSpriteFrame(m, frame) {
  const { mem8 } = m;

  const toggledMirror = (mem8[MARIO_SPRITE_CODE] & MIRROR_BIT) ^ MIRROR_BIT;
  mem8[MARIO_SPRITE_CODE] = toggledMirror | frame;

  markOnLadderAndCommitSprite(m);
}
