// SPDX-License-Identifier: GPL-3.0-only
// Select the VRAM digit-field cursor from a field selector -- the primary field when zero, the alternate
// field otherwise -- then paint the packed-BCD number column into it.
import { drawBcdNumberColumn } from "./drawBcdNumberColumn.js";
import { DIGIT_FIELD_PRIMARY, DIGIT_FIELD_ALT } from "./names.js";

export function drawScoreToSelectedPlayerField(m, field = m.regs.a, source = m.regs.de) {
  const cursor = field === 0 ? DIGIT_FIELD_PRIMARY : DIGIT_FIELD_ALT;
  return drawBcdNumberColumn(m, source, cursor);
}
