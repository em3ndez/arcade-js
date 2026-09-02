// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdByte } from "./drawBcdByte.js";
import { CREDIT_COUNT, CREDIT_COUNT_SCREEN_ADDR } from "./names.js";

// Draw the BCD credit tally as two decimal glyphs at its on-screen slot; live-out HL.
export function drawCreditCount(m) {
  return (m.regs.hl = CREDIT_COUNT_SCREEN_ADDR, drawBcdByte(m, m.mem8[CREDIT_COUNT]));
}
