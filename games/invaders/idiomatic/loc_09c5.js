// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";

// Map a low nibble to its hex-glyph id and plot the glyph; live-out HL.
export function loc_09c5(m, a = m.regs.a) {
  return drawSprite8x8(m, u8(a + 0x1a));
}
