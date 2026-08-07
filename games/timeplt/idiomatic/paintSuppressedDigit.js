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

const GLYPHS = 0x0dcc;
const BLANK_ENTRY_CELL = 0x3246;
const CHARACTER_PLANE_BIT = 0x0400;
const LOW_NIBBLE = 0x0f;

export function paintSuppressedDigit(m) {
  const { mem8, regs } = m;
  const digit = regs.a & LOW_NIBBLE;

  let entry;
  if (digit !== 0) {
    regs.b = regs.b + 1;
    entry = digit;
  } else {
    entry = regs.b === 0 ? mem8[BLANK_ENTRY_CELL] : 0;
  }

  const held = regs.hl;
  regs.hl = GLYPHS;
  regs.a = entry;
  const glyph = fetchTableByte(m);
  regs.hl = held;

  const cell = regs.de;
  mem8[cell] = glyph;
  regs.a = regs.c;
  mem8[cell & ~CHARACTER_PLANE_BIT] = regs.a;
  regs.de = cell | CHARACTER_PLANE_BIT;
}
