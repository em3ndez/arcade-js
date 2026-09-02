// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { loc_1ae4, loc_241e } from "./names.js";

// Draw a preset run of sprites (fixed id list, count and screen slot) through the sprite-list driver.
export function loc_191a(m) {
  return drawSpriteList(m, loc_1ae4, 0x1c, loc_241e);
}
