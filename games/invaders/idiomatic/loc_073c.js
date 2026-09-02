// SPDX-License-Identifier: GPL-3.0-only
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";

// Resolve the sprite's screen address and gfx pointer from its record, then blit the sprite column.
export function loc_073c(m) {
  resolveSpriteScreenAddr(m);
  return drawSpriteColumn(m);
}
