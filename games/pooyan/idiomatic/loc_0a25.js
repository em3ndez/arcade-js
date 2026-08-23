// SPDX-License-Identifier: GPL-3.0-only
import { loc_0a28 } from "./loc_0a28.js";
import { ANIM_FRAME_COUNTER } from "./names.js";
/**
 * loc_0a25 — seeds the frame-animation cursor, then tail-hands to the two-slot
 * tile painter, returning its result straight to this routine's own caller.
 *
 * LIVE-OUT: inherits the painter's; this routine contributes none of its own.
 */
export function loc_0a25(m) {
  return loc_0a28(m, ANIM_FRAME_COUNTER);
}
