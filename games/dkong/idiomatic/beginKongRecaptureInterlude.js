// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginKongRecaptureInterlude — step 0 of the board-cleared interlude (odd boards): spawn the
 * opening tableau, stage the first 40-byte animation-frame template, arm the pose-hold
 * countdown, then fall into the shared advance tail.
 *
 * LIVE-OUT: memory-only — the tableau writes, the 40-byte template copy, the armed pose-hold
 * countdown, the stepped sequence counter, and on 25m the raised Y column.
 */

import { spawnInterludeHeart } from "./spawnInterludeHeart.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js";
import { SUBSTATE_TIMER } from "./names.js";

const ANIM_FRAME_SRC = 0x385c;
const POSE_HOLD_FRAMES = 0x20;

export function beginKongRecaptureInterlude(m) {
  const { mem8 } = m;

  spawnInterludeHeart(m);

  loadSpriteObjectBlock(m, ANIM_FRAME_SRC);

  mem8[SUBSTATE_TIMER] = POSE_HOLD_FRAMES;

  advanceInterludeStepAndLiftKongFigure(m);
}
