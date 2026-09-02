// SPDX-License-Identifier: GPL-3.0-only
import { drawDigit } from "./drawDigit.js";
import { loc_2501 } from "./names.js";

// Seat the glyph screen base, reduce the value to a hex nibble, then plot the glyph.
export function loc_1a8b(m, a = m.regs.a) {
  return (m.regs.hl = loc_2501, drawDigit(m, a & 0x0f));
}
