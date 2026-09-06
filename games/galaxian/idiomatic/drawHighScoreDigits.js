// SPDX-License-Identifier: GPL-3.0-only
// Paint a 6-digit packed-BCD number into a fixed VRAM number-field cursor; the source pointer is
// passed in by the caller.
import { drawBcdNumberColumn } from "./drawBcdNumberColumn.js";
import { loc_5241 } from "./names.js";

export function drawHighScoreDigits(m, source = m.regs.de) {
  return drawBcdNumberColumn(m, source, loc_5241);
}
