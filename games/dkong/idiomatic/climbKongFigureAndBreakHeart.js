// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbKongFigureAndBreakHeart — hold the board-cleared interlude while the Kong figure climbs,
 * then break the heart and move the sequence on.
 *
 * A step handler in the board-cleared interlude that plays between boards, on the odd boards.
 * The interlude runs as a numbered sequence and a step selector says which step this frame
 * belongs to; this handler owns one of them. Where its siblings hold their pose on a frame
 * timer, this step holds on an animation POSITION instead:
 *
 *   1. Tick the sprite-object block's animation one frame. A private one-in-eight phase
 *      counter advances every call, and on the eighth call the whole ten-record group scrolls
 *      up four pixels and its code bytes animate.
 *   2. Read the probed record's Y and HOLD this step while the figure is still at or below the
 *      top threshold. Since the group only climbs on every eighth call, most frames just tick
 *      the phase counter and hold. Larger Y is lower on this screen, so "above the threshold"
 *      is numerically below it.
 *   3. Once the probed record has scrolled above the threshold, finish the step: park three
 *      sprite X bytes at zero, restore two more to the X their template gives them (an earlier
 *      step parked them for the whole climb), BREAK THE HEART by stepping the heart record's
 *      sprite code on by one — the same shape with a jagged split through it — and advance the
 *      step selector so the interlude moves on.
 *
 * Everything past the animation tick is plain shadow-buffer and selector writes.
 *
 * WHAT THE NAME DOES NOT CLAIM: that the figure lifts Pauline. Asserting that would require
 * separating Pauline's record from the ten-record block, and that separation was never made, so
 * neither the two records restored here nor any other record in the block may be described as
 * her. What is byte-measured is that ONE figure scrolls up and the heart breaks on the frame it
 * clears the top.
 *
 * LIVE-OUT: memory-only — the phase counter, the scrolled sprite-object block, and on the
 * finish frame the parked X bytes, the heart's code byte and the step selector. Nothing reads a
 * value back from this handler.
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js";
import { SPRITE_BUFFER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

const SCROLL_PROBE = SPRITE_OBJ_BLOCK + 0x0b; // sprite-object record 2's Y (field 3)
const SCROLL_TOP = 0x2c; // finish once the probed record's Y has climbed above this

export function climbKongFigureAndBreakHeart(m) {
  const { mem } = m;

  // 1. Advance the sprite-object-block animation one frame (1-in-8 phase; on the eighth
  //    call it scrolls the ten-record group up 4px and animates the code bytes).
  animateSpriteObjectBlock(m);

  // 2. Hold this step until the probed record's Y has climbed above the top threshold.
  //    Still at that row or LOWER ON SCREEN (numerically at or above it, larger Y being
  //    lower) → nothing more this frame.
  if (mem.read8(SCROLL_PROBE) >= SCROLL_TOP) return;

  // 3. Reached the top — finish the step. Three X bytes are parked at zero.
  mem.write8(SPRITE_BUFFER + 0x00, 0x00); // record 0's X
  mem.write8(SPRITE_BUFFER + 0x04, 0x00); // record 1's X
  mem.write8(SPRITE_OBJ_BLOCK + 0x04, 0x00); // object-record 1's X
  mem.write8(SPRITE_OBJ_BLOCK + 0x1c, 0x6b); // object-record 7's X, back to its template value
  mem.write8(SPRITE_OBJ_BLOCK + 0x24, 0x6a); // object-record 9's X, back to its template value

  // BREAK THE HEART: step the heart record's sprite code on by one — the whole heart
  // becomes the same heart, cracked.
  const codeByte = SPRITE_BUFFER + 0x121; // the heart record's sprite code
  mem.write8(codeByte, (mem.read8(codeByte) + 1) & 0xff);

  // Advance the interlude's step selector, so the next frame runs the following step.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
