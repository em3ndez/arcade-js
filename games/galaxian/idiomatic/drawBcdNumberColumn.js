// SPDX-License-Identifier: GPL-3.0-only
// drawBcdNumberColumn -- ROM 0x2261 [seen]. Paints a six-digit decimal readout for a score / high-score HUD
// field. The value is three packed-BCD bytes in work RAM: the most-significant byte sits at the source
// pointer and the walk steps DOWNWARD (ptr - 1) each byte. Each byte yields two digits (high nibble then
// low); the VRAM cursor steps one tile row UP (-32) per digit, so the six digits stack up the screen column
// most-significant at the top. A four-digit leading-zero blank budget threads through the per-digit calls to
// suppress insignificant high zeros. Callers (drawScoreToSelectedPlayerField, drawHighScoreDigits) point DE
// at the BCD field and IX at that field's bottom VRAM cell.
// Paint three packed-BCD bytes (walked downward from the source pointer) as six digit tiles into the
// cursor, high nibble then low, stepping the cursor up one row per digit with leading-zero blanking.
import { u16 } from "../../../core/int.js";
import { drawBcdDigit } from "./drawBcdDigit.js";

const ROW_UP = -32; // one tile row up: the per-digit cursor stride

export function drawBcdNumberColumn(m, source = m.regs.de, cursor = m.regs.ix) {
  const { mem8 } = m;

  let blank = 4; // leading-zero blank budget
  let ptr = source;

  // Three source bytes, most-significant first; each carries two stacked digits up the column. drawBcdDigit
  // threads `blank` through every call so leading-zero suppression spans the whole six-digit number.
  for (let i = 0; i < 3; i++) {
    const byte = mem8[ptr];
    // High nibble = the more-significant digit of this byte; draw it, then step the cursor one row up.
    blank = drawBcdDigit(m, (byte >> 4) & 0x0f, blank, cursor, ROW_UP);
    cursor = u16(cursor + ROW_UP);
    // Low nibble = the less-significant digit; draw it one row further up and step again.
    blank = drawBcdDigit(m, byte & 0x0f, blank, cursor, ROW_UP);
    cursor = u16(cursor + ROW_UP);
    // Walk memory downward to the next-less-significant BCD byte as the column walks upward.
    ptr = u16(ptr - 1);
  }
}
