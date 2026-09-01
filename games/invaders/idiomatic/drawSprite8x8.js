// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_1e00 } from "./names.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";

// Point DE at sprite A's 8-byte source, latch its shift count, and blit it down 8 columns. Live-out: HL.
export function drawSprite8x8(m, a = m.regs.a, hl = m.regs.hl) {
  const src = u16(loc_1e00 + 8 * a);
  m.io.portOut(0x06, a);
  return drawSpriteColumn(m, hl, src, 8);
}
