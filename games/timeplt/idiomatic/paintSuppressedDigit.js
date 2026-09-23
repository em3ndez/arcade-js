// SPDX-License-Identifier: GPL-3.0-only
/** paintSuppressedDigit — paint one four-bit digit into the cell the cursor names, lay the caller's colour
 * beside it in the plane below, and leave the cursor snapped onto the character side.
 *
 * A digit only reaches the glyph table through an index, and the index is where the suppression
 * lives: a non-zero digit indexes by its own value AND steps a flag on, while a zero indexes
 * either the blank entry or entry zero depending on whether that flag is still clear. So the
 * flag separates the zeros ahead of the first significant digit from the zeros after it, and it
 * is the caller who owns the flag across a run of these. Which entry the blank is is not an
 * immediate here either; it is fetched from a byte of the program image.
 * LIVE-OUT: the two cells painted, the flag, the cursor, and the colour. */

import { fetchTableByte } from "./fetchTableByte.js";
import { DIGIT_GLYPH_TABLE, LEADING_ZERO_BLANK_GLYPH_INDEX } from "./names.js";

const CHARACTER_PLANE_BIT = 1 << 10; // bit 10: character/attribute plane select
const LOW_NIBBLE = 0x0f;

export function paintSuppressedDigit(m, a = m.regs.a, b = m.regs.b, c = m.regs.c, hl = m.regs.hl, de = m.regs.de) {
  const { mem8 } = m;
  const digit = a & LOW_NIBBLE;

  let entry, flag = b;
  if (digit !== 0) {
    flag = b + 1;
    entry = digit;
  } else {
    entry = b === 0 ? mem8[LEADING_ZERO_BLANK_GLYPH_INDEX] : 0;
  }

  const glyph = fetchTableByte(m, DIGIT_GLYPH_TABLE, entry);
  const cell = de;
  mem8[cell] = glyph;
  mem8[cell & ~CHARACTER_PLANE_BIT] = c;
  return [m.regs.b = flag, m.regs.hl = hl, m.regs.a = c, m.regs.de = cell | CHARACTER_PLANE_BIT];
}
