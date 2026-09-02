// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { SCORE_HEADER_TEXT, SCORE_HEADER_SCREEN_ADDR } from "./names.js";

// Draw a preset run of sprites (fixed id list, count and screen slot) through the sprite-list driver.
export function drawScoreHeader(m) {
  return drawSpriteList(m, SCORE_HEADER_TEXT, 0x1c, SCORE_HEADER_SCREEN_ADDR);
}
