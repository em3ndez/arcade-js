// SPDX-License-Identifier: GPL-3.0-only
/** paintUnsuppressedDigit — paint one decimal digit, with its colour, into the cell a cursor
 * names. Only the low four bits are used, and they index a glyph table; sixteen values can reach
 * it, which is more than it has entries, so the highest few land past its end. The glyph goes to
 * the cell, the caller's colour to the same cell in the plane beside it, and the cursor comes back
 * on the glyph side whether or not it arrived there. The run pointer the caller was walking is
 * saved across the lookup and handed back where it was.
 * LIVE-OUT: the two cells, the cursor, and the run pointer, unchanged. A is dead but matched. */

import { fetchTableByte } from "./fetchTableByte.js";
import { DIGIT_GLYPH_TABLE } from "./names.js";

const DIGIT_BITS = 0x0f;
const CHARACTER_PLANE_BIT = 1 << 10; // bit 10: character/attribute plane select

export function paintUnsuppressedDigit(m, a = m.regs.a, c = m.regs.c, hl = m.regs.hl, de = m.regs.de) {
  const { mem8 } = m;
  const runPointer = hl;
  const glyph = fetchTableByte(m, DIGIT_GLYPH_TABLE, a & DIGIT_BITS);

  mem8[de] = glyph;
  mem8[de & ~CHARACTER_PLANE_BIT] = c;
  // hand back the saved run pointer, the (dead but matched) colour in A, and the cursor on the glyph side
  return [m.regs.hl = runPointer, m.regs.a = c, m.regs.de = de | CHARACTER_PLANE_BIT];
}
