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

import { u8, u16 } from "../../../core/int.js";
import { F_C, F_N, F_H, F_PV, F_S, F_Z, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR } from "./names.js";

const CELLS_PER_LINE = 32;
const CELL_STEP = 32;
const BLANK_GLYPH = 241;
const LINE_COLOUR = 16;
const CHARACTER_PLANE_BIT = 0x400;

export function blankNextLine(m) {
  const { mem8, mem16 } = m;
  let cursor = mem16[BLANK_LINE_CURSOR];
  let stepCarry = 0;
  for (let cell = 0; cell < CELLS_PER_LINE; cell++) {
    mem8[cursor] = BLANK_GLYPH;
    mem8[cursor & ~CHARACTER_PLANE_BIT] = LINE_COLOUR;
    const sum = (cursor | CHARACTER_PLANE_BIT) + CELL_STEP;
    stepCarry = (sum >> 16) ? F_C : 0;
    cursor = u16(sum);
  }
  mem16[BLANK_LINE_CURSOR] = u16(mem16[BLANK_LINE_CURSOR] + 1);
  const left = u8(mem8[BLANK_LINES_LEFT] - 1);
  mem8[BLANK_LINES_LEFT] = left;
  // The count-down leaves the subtract flags behind; the carry is the one the final cursor step set.
  const sz = (left & 0x80 ? F_S : 0) | (left === 0 ? F_Z : 0) | (left & (F_F3 | F_F5));
  const flagsOut =
    stepCarry | sz | F_N | ((left & 0x0f) === 0x0f ? F_H : 0) | (left === 0x7f ? F_PV : 0);
  return (m.regs.hl = BLANK_LINES_LEFT, m.regs.b = 0, m.regs.de = CELL_STEP, m.regs.f = flagsOut, left === 0);
}
