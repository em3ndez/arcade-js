// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteColumn } from "./drawSpriteColumn.js";

// Draw a 16-row sprite column, leaving the caller's BC untouched. Live-out: memory and HL.
export function loc_1844(m, hl = m.regs.hl, de = m.regs.de) {
  return drawSpriteColumn(m, hl, de, 0x10);
}
