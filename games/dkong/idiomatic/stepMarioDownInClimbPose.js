// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMarioDownInClimbPose — step Mario down one pixel, held in the climb-down pose: nudge his
 * logical Y and his hardware sprite-record Y down one each, with the sprite pinned to a fixed
 * climb frame.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_Y } from "./names.js";
import { pinMarioClimbPose } from "./pinMarioClimbPose.js";

export function stepMarioDownInClimbPose(m) {
  const { mem8 } = m;

  mem8[MARIO_Y] = mem8[MARIO_Y] + 1;

  const spriteYPtr = pinMarioClimbPose(m);
  mem8[spriteYPtr] = mem8[spriteYPtr] + 1;
}
