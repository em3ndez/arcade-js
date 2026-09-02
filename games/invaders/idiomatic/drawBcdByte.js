// SPDX-License-Identifier: GPL-3.0-only
import { drawDigit } from "./drawDigit.js";

// Draw a byte as two decimal (BCD) glyphs -- high nibble first, then low; live-out HL (past both glyphs).
export function drawBcdByte(m, a = m.regs.a) {
  drawDigit(m, (a >> 4) & 0x0f);
  return drawDigit(m, a & 0x0f);
}
