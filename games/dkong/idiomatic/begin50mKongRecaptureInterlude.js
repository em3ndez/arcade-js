// SPDX-License-Identifier: GPL-3.0-only
/**
 * begin50mKongRecaptureInterlude — first step of the even-board board-cleared interlude:
 * spawn the opening tableau, re-stamp the fixed ten-record figure template over the sprite-
 * object block while preserving its current horizontal position, then advance the step.
 *
 * Record 2's CURRENT X is captured BEFORE the template copy overwrites it and turned into a
 * shift relative to the template's anchor; after the copy the shift is added into the X byte
 * of all ten records, so the figure keeps its X across the re-stamp (a per-frame 50m slide can
 * leave it anywhere along that column).
 *
 * LIVE-OUT: memory-only — the sprite-object block, the step selector, and everything the
 * opening tableau writes.
 */

import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";
import { spawnInterludeHeart } from "./spawnInterludeHeart.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const RECORD2_X = SPRITE_OBJ_BLOCK + 0x08;
const FIGURE_TEMPLATE = 0x385c;
const TEMPLATE_ANCHOR_X = 0x3b;

export function begin50mKongRecaptureInterlude(m) {
  const { mem8 } = m;

  spawnInterludeHeart(m);

  // Read BEFORE the copy below overwrites this byte — the shift must measure the OLD X.
  const shift = (mem8[RECORD2_X] - TEMPLATE_ANCHOR_X) & 0xff;

  loadSpriteObjectBlock(m, FIGURE_TEMPLATE);

  addToSpriteObjectColumn(m, SPRITE_OBJ_BLOCK, shift);

  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
}
