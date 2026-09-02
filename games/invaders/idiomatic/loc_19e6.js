// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { clearScreenRegion } from "./clearScreenRegion.js";
import { loc_2701, loc_1c60 } from "./names.js";

// Seat the strip base; when armed, paint a caller-counted run of 16-byte columns, then blank the strips below.
export function loc_19e6(m, a = m.regs.a, z = m.regs.fZ) {
  let hl = loc_2701;
  if (z) return clearScreenRegion(m, hl);
  let counter = a;
  do {
    hl = drawSpriteColumn(m, hl, loc_1c60, 0x10);
    counter = u8(counter - 1);
  } while (counter !== 0);
  return clearScreenRegion(m, hl);
}
