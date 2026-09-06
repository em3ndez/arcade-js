// SPDX-License-Identifier: GPL-3.0-only
// Paint three packed-BCD bytes (walked downward from the source pointer) as six digit tiles into the
// cursor, high nibble then low, stepping the cursor up one row per digit with leading-zero blanking.
import { u16 } from "../../../core/int.js";
import { drawBcdDigit } from "./drawBcdDigit.js";

const ROW_UP = -32; // one tile row up: the per-digit cursor stride

export function drawBcdNumberColumn(m, source = m.regs.de, cursor = m.regs.ix) {
  const { mem8 } = m;

  let blank = 4; // leading-zero blank budget
  let ptr = source;

  for (let i = 0; i < 3; i++) {
    const byte = mem8[ptr];
    blank = drawBcdDigit(m, (byte >> 4) & 0x0f, blank, cursor, ROW_UP);
    cursor = u16(cursor + ROW_UP);
    blank = drawBcdDigit(m, byte & 0x0f, blank, cursor, ROW_UP);
    cursor = u16(cursor + ROW_UP);
    ptr = u16(ptr - 1);
  }
}
