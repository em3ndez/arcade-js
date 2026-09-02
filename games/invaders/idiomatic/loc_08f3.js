// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";

// Blit a run of sprites whose ids sit consecutively in memory, walking the screen pointer down per id.
export function loc_08f3(m, de = m.regs.de, c = m.regs.c, hl = m.regs.hl) {
  let ptr = de;
  let count = c;
  let dst = hl;
  do {
    dst = drawSprite8x8(m, m.mem8[ptr], dst);
    ptr = u16(ptr + 1);
    count = u8(count - 1);
  } while (count !== 0);
  return [(m.regs.hl = dst), (m.regs.de = ptr), (m.regs.c = count)];
}
