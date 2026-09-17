// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateIntroClimbStep — step 2 of the opening Kong-climb cutscene, re-dispatched every frame:
 * advance the sprite-object block and bump the private tick counter; every 16th tick scroll the
 * climb graphic up one row; and once the climbing figure's Y tops out, advance the cutscene — arm
 * a 32-frame pause, step INTRO_STEP 2 -> 3, and point SEQ_ADVANCE_PTR at INTRO_STEP.
 *
 * LIVE-OUT: memory-only.
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js";
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js";
import { SUBSTATE_TIMER, INTRO_STEP, SEQ_ADVANCE_PTR, SPRITE_OBJ_BLOCK } from "./names.js";

const TICK_COUNTER = 0x62af; // cutscene's private 1-in-16 tick counter; no shared name
const CLIMBER_Y = SPRITE_OBJ_BLOCK + 3; // record 0's Y byte — the climbing figure

export function animateIntroClimbStep(m) {
  const { mem8, mem16 } = m;

  animateSpriteObjectBlock(m);

  if ((mem8[TICK_COUNTER] & 0x0f) === 0) {
    scrollClimbGraphicStep(m);
  }

  if (mem8[CLIMBER_Y] >= 0x5d) return;

  mem8[SUBSTATE_TIMER] = 0x20;
  mem8[INTRO_STEP] = mem8[INTRO_STEP] + 1;
  mem16[SEQ_ADVANCE_PTR] = INTRO_STEP;
}
