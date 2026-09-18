// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepKongWalk — advance the first timed board object, then slide the ten-sprite figure one step
 * along X by the signed per-frame step that object publishes.
 *
 * LIVE-OUT: memory-only.
 */

import { SPRITE_OBJ_BLOCK, M50_OBJ1_STEP } from "./names.js";
import { loc_2602 } from "./loc_2602.js";
import { addStrided } from "./addStrided.js";

export function stepKongWalk(m) {
  const { regs, mem8 } = m;

  loc_2602(m);

  addStrided(m, mem8[M50_OBJ1_STEP], 0x0004, 0x0a, SPRITE_OBJ_BLOCK);
}
