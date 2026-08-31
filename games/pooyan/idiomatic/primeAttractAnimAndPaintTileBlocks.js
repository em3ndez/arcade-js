// SPDX-License-Identifier: GPL-3.0-only
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { ANIM_FRAME_COUNTER } from "./names.js";
/**
 * primeAttractAnimAndPaintTileBlocks — seeds the frame-animation cursor, then tail-hands to the two-slot
 * tile painter, returning its result straight to this routine's own caller.
 *
 * LIVE-OUT: inherits the painter's; this routine contributes none of its own.
 */
export function primeAttractAnimAndPaintTileBlocks(m) {
  return advanceAttractAnimationAndRepaint(m, ANIM_FRAME_COUNTER);
}
