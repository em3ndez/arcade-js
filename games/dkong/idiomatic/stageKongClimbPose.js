// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageKongClimbPose — one timer-gated step of the board-cleared interlude: on the timer's expiry
 * frame, reload the sprite-object block from a fixed template, re-stamp/clear a few bytes, then
 * tail into the shared board-advance tail. While the timer counts down the pose is held.
 *
 * LIVE-OUT: memory-only.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js";
import {
  SPRITE_OBJECT_BLOCK_TEMPLATE,
  SPRITE_OBJ_BLOCK,
} from "./names.js";

const STAMP_ADDR = SPRITE_OBJ_BLOCK + 0x04;
const STAMP_VALUE = 0x66;
const CLEAR_A = SPRITE_OBJ_BLOCK + 0x1c;
const CLEAR_B = SPRITE_OBJ_BLOCK + 0x24;
const BOARD_BOOKKEEPING = 0x62af;

export function stageKongClimbPose(m) {
  const { mem8 } = m;

  if (!tickSubstateTimer(m)) return;

  loadSpriteObjectBlock(m, SPRITE_OBJECT_BLOCK_TEMPLATE);

  mem8[STAMP_ADDR] = STAMP_VALUE;
  mem8[CLEAR_A] = 0;
  mem8[CLEAR_B] = 0;
  mem8[BOARD_BOOKKEEPING] = 0;

  advanceInterludeStepAndLiftKongFigure(m);
}
