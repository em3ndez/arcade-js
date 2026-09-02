// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { clearScreenRegion } from "./clearScreenRegion.js";
import { RESERVE_SHIP_ICONS_SCREEN_ADDR, RESERVE_SHIP_SPRITE } from "./names.js";

// Seat the strip base; when armed, paint a caller-counted run of 16-byte columns, then blank the strips below.
export function drawReserveLifeIcons(m, a = m.regs.a, z = m.regs.fZ) {
  let hl = RESERVE_SHIP_ICONS_SCREEN_ADDR;
  if (z) return clearScreenRegion(m, hl);
  let counter = a;
  do {
    hl = drawSpriteColumn(m, hl, RESERVE_SHIP_SPRITE, 0x10);
    counter = u8(counter - 1);
  } while (counter !== 0);
  return clearScreenRegion(m, hl);
}
