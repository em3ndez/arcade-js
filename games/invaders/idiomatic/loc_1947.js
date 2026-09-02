// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdByte } from "./drawBcdByte.js";
import { loc_20eb, loc_3c01 } from "./names.js";

// Draw the BCD credit tally as two decimal glyphs at its on-screen slot; live-out HL.
export function loc_1947(m) {
  return (m.regs.hl = loc_3c01, drawBcdByte(m, m.mem8[loc_20eb]));
}
