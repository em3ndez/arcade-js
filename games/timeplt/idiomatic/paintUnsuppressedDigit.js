// SPDX-License-Identifier: GPL-3.0-only
/** paintUnsuppressedDigit — paint one decimal digit, with its colour, into the cell a cursor
 * names. Only the low four bits are used, and they index a glyph table; sixteen values can reach
 * it, which is more than it has entries, so the highest few land past its end. The glyph goes to
 * the cell, the caller's colour to the same cell in the plane beside it, and the cursor comes back
 * on the glyph side whether or not it arrived there. The run pointer the caller was walking is
 * saved across the lookup and handed back where it was.
 * LIVE-OUT: the two cells, the cursor, and the run pointer, unchanged. A is dead but matched. */

import { fetchTableByte } from "./fetchTableByte.js";

const GLYPHS = 0x0dcc;
const DIGIT_BITS = 0x0f;
const CHARACTER_PLANE_BIT = 0x0400;

export function paintUnsuppressedDigit(m) {
  const { regs, mem8 } = m;
  const runPointer = regs.hl;
  regs.hl = GLYPHS;
  regs.a = regs.a & DIGIT_BITS;
  const glyph = fetchTableByte(m);
  regs.hl = runPointer;

  mem8[regs.de] = glyph;
  regs.a = regs.c;
  mem8[regs.de & ~CHARACTER_PLANE_BIT] = regs.a;
  regs.de |= CHARACTER_PLANE_BIT;
}
