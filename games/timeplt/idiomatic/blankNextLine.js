// SPDX-License-Identifier: GPL-3.0-only
/** blankNextLine — blank one line of the character plane and move the eraser on to the next line.
 *
 * A cursor cell says where the line starts. Thirty-two cells are walked from there, each given
 * the blanking glyph and, in the plane beside it, one fixed colour. Coming back from that plane
 * is a SET rather than a restore, so a cursor arriving on the colour side has its first cell
 * blanked there and is then snapped across for the rest of the line. The cursor is re-read
 * afterwards and advanced by ONE — the next line, not the next cell — and a counter of lines
 * still to erase is taken down by one.
 * LIVE-OUT: the cells, the cursor, the counter, and whether that counter has reached zero,
 * returned and left in the flags. */

import { u16 } from "../../../core/int.js";
import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR } from "./names.js";

const CELLS_PER_LINE = 32;
const CELL_STEP = 32;
const BLANK_GLYPH = 241;
const LINE_COLOUR = 16;
const CHARACTER_PLANE_BIT = 0x0400;

export function blankNextLine(m) {
  const { regs, mem8, mem16 } = m;
  let cursor = mem16[BLANK_LINE_CURSOR];
  for (let cell = 0; cell < CELLS_PER_LINE; cell++) {
    mem8[cursor] = BLANK_GLYPH;
    mem8[cursor & ~CHARACTER_PLANE_BIT] = LINE_COLOUR;
    cursor = u16((cursor | CHARACTER_PLANE_BIT) + CELL_STEP);
  }
  mem16[BLANK_LINE_CURSOR] = u16(mem16[BLANK_LINE_CURSOR] + 1);
  const left = regs.dec8(mem8[BLANK_LINES_LEFT]);
  mem8[BLANK_LINES_LEFT] = left;
  return left === 0;
}
