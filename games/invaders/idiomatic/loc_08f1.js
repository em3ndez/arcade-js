// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";

// Run the sprite-list driver over a fixed run of three consecutive entries.
export function loc_08f1(m, de = m.regs.de) {
  return drawSpriteList(m, de, 0x03);
}
