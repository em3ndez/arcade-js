// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetColorCycleSweep — end the colour-cycle sweep when its counter tops out (clear the counter
 * and lower the active flag), then continue the frame's colour work. With the reload gate nonzero
 * go straight to the repaint; with it zero, reload the sprite-object block then run the cascade.
 *
 * LIVE-OUT: memory-only — the two counter clears plus whatever the callees paint or reload.
 */

import { ANIM_STEP_COUNTER, COLOUR_CYCLE_ACTIVE, loc_6393 } from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";
import { dispatchColorCascadeByBoard } from "./dispatchColorCascadeByBoard.js";

const OBJ_TEMPLATE = 0x385c;

export function resetColorCycleSweep(m) {
  const { mem8 } = m;

  mem8[ANIM_STEP_COUNTER] = 0;
  mem8[COLOUR_CYCLE_ACTIVE] = 0;

  if (mem8[loc_6393] !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  loadSpriteObjectBlock(m, OBJ_TEMPLATE);
  dispatchColorCascadeByBoard(m);
}
