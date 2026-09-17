// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbKongFigureAndBreakHeart — a step handler in the odd-board board-cleared interlude. It
 * ticks the sprite-object block's animation (the group scrolls up 4px every eighth call) and
 * holds this step on an animation POSITION: while the probed record's Y is at or below the top
 * threshold, hold. Once it clears the top, finish — park three sprite X bytes, restore two to
 * their template X, break the heart by stepping its sprite code on by one, and advance the step
 * selector. Larger Y is lower on screen, so "above the threshold" is numerically below it.
 *
 * LIVE-OUT: memory-only — the phase counter, the scrolled sprite-object block, and on the finish
 * frame the parked X bytes, the heart's code byte and the step selector.
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js";
import { SPRITE_BUFFER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

const SCROLL_PROBE = SPRITE_OBJ_BLOCK + 0x0b;
const SCROLL_TOP = 0x2c; // finish once the probed record's Y has climbed above this

export function climbKongFigureAndBreakHeart(m) {
  const { mem8 } = m;

  animateSpriteObjectBlock(m);

  // Hold while the probed record is still at or lower on screen (numerically >= the threshold).
  if (mem8[SCROLL_PROBE] >= SCROLL_TOP) return;

  mem8[SPRITE_BUFFER + 0x00] = 0x00;
  mem8[SPRITE_BUFFER + 0x04] = 0x00;
  mem8[SPRITE_OBJ_BLOCK + 0x04] = 0x00;
  mem8[SPRITE_OBJ_BLOCK + 0x1c] = 0x6b; // back to its template X
  mem8[SPRITE_OBJ_BLOCK + 0x24] = 0x6a; // back to its template X

  // Break the heart: step its sprite code on by one — the same heart, cracked.
  const codeByte = SPRITE_BUFFER + 0x121;
  mem8[codeByte] = (mem8[codeByte] + 1) & 0xff;

  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1) & 0xff;
}
