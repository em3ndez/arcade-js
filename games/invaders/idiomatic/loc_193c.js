// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { loc_1fa9, loc_3501 } from "./names.js";

// Draw a preset run of sprites (fixed id list, count and screen slot) through the sprite-list driver.
export function loc_193c(m) {
  return drawSpriteList(m, loc_1fa9, 0x07, loc_3501);
}
