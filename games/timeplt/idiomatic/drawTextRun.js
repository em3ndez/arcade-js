// SPDX-License-Identifier: GPL-3.0-only
/** drawTextRun — paint one caption into the character plane and give every cell of it one colour.
 * Glyphs are taken in order from a run that ends at a fixed terminating code. That code is
 * tested BEFORE anything is written, so an empty run paints nothing and the code itself is
 * never painted. Each glyph goes to the cell the cursor names, the caller's colour goes to the
 * same cell in the other plane, and the cursor then steps one place along the line.
 * Coming back from the colour plane is a SET, not a restore: a cursor that arrives already on
 * the colour side has its glyph overwritten by its own colour and is snapped across.
 * The run is left reading the terminator, so the accumulator holds that code and the flags are
 * the ones a compare of it against itself leaves — a zero result with the code's own low bits.
 * LIVE-OUT: the cells painted, the cursor and the run pointer left on the terminator, and the
 * accumulator and flags that final compare set. */

import { u16 } from "../../../core/int.js";
import { F_Z, F_N, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const END_OF_TEXT = 185;
const CHARACTER_PLANE_BIT = 0x400;
// The terminator is met by comparing that byte with itself: a zero result (so zero flag and no
// borrow), the subtract flag, and the undocumented bits copied from the byte compared against.
const TERMINATOR_FLAGS = F_Z | F_N | (END_OF_TEXT & (F_F3 | F_F5));

export function drawTextRun(m, run = m.regs.hl, cursor = m.regs.de, colour = m.regs.c) {
  const { mem8 } = m;
  let nextGlyph = run;
  let cell = cursor;
  for (;;) {
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    mem8[cell] = glyph;
    mem8[cell & ~CHARACTER_PLANE_BIT] = colour;
    cell |= CHARACTER_PLANE_BIT;
    nextGlyph = u16(nextGlyph + 1);
    cell = advanceCharCursor(m, cell);
  }
  return (m.regs.hl = nextGlyph, m.regs.de = cell, m.regs.a = END_OF_TEXT, m.regs.f = TERMINATOR_FLAGS);
}
