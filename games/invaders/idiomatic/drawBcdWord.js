// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdByte } from "./drawBcdByte.js";

// Draw the 16-bit value in DE as four BCD glyphs: the high byte first, then the low byte.
export function drawBcdWord(m, d = m.regs.d, e = m.regs.e) {
  drawBcdByte(m, d);
  return drawBcdByte(m, e);
}
