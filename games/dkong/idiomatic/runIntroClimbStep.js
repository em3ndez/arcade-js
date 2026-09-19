// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroClimbStep — stage one climb phase of the opening Kong-climb cutscene. A one-shot timer
 * gate: every frame it ticks the cutscene countdown and does nothing else until it expires, then
 * copies the phase's ten-record sprite block, nudges it into position, seeds two bytes, queues the
 * intro tune, and advances the cutscene step.
 *
 * LIVE-OUT: memory-only.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addStrided } from "./addStrided.js";
import {
  INTRO_SCROLL_INDEX,
  INTRO_STEP,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SPRITE_OBJECT_BLOCK_TEMPLATE,
  SPRITE_OBJ_BLOCK,
} from "./names.js";


export function runIntroClimbStep(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  loadSpriteObjectBlock(m, SPRITE_OBJECT_BLOCK_TEMPLATE);

  // Two strided add-passes (stride 4, ten records): field 0 takes one constant, field 3 another.
  addStrided(m, 0x30, 0x04, 0x0a, SPRITE_OBJ_BLOCK);
  addStrided(m, 0x99, 0x04, 0x0a, SPRITE_OBJ_BLOCK + 3);

  // These seeds run AFTER the add-passes: record 1's first field overwrites what pass 1 wrote.
  mem8[INTRO_SCROLL_INDEX] = 0x1f;
  mem8[SPRITE_OBJ_BLOCK + 4] = 0x00;

  mem8[SND_PRIORITY] = 0x01;
  mem8[SND_PRIORITY_FRAMES] = 0x03;

  mem8[INTRO_STEP] = (mem8[INTRO_STEP] + 1);
}
