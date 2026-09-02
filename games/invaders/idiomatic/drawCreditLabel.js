// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { CREDIT_LABEL_TEXT, CREDIT_LABEL_SCREEN_ADDR } from "./names.js";

// Draw a preset run of sprites (fixed id list, count and screen slot) through the sprite-list driver.
export function drawCreditLabel(m) {
  return drawSpriteList(m, CREDIT_LABEL_TEXT, 0x07, CREDIT_LABEL_SCREEN_ADDR);
}
