// SPDX-License-Identifier: GPL-3.0-only
import { drawDigit } from "./drawDigit.js";
import { LIVES_DIGIT_SCREEN_ADDR } from "./names.js";

// Seat the glyph screen base, reduce the value to a decimal nibble, then plot the glyph.
export function drawLivesDigit(m, a = m.regs.a) {
  return (m.regs.hl = LIVES_DIGIT_SCREEN_ADDR, drawDigit(m, a & 0x0f));
}
