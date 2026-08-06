// SPDX-License-Identifier: GPL-3.0-only
/** drawTextRun — paint one caption into the character plane and give every cell of it one colour.
 * Glyphs are taken in order from a run that ends at a fixed terminating code. That code is
 * tested BEFORE anything is written, so an empty run paints nothing and the code itself is
 * never painted. Each glyph goes to the cell the cursor names, the caller's colour goes to the
 * same cell in the other plane, and the cursor then steps one place along the line.
 * Coming back from the colour plane is a SET, not a restore: a cursor that arrives already on
 * the colour side has its glyph overwritten by its own colour and is snapped across.
 * LIVE-OUT: the cells painted, plus the cursor and the run pointer left on the terminator. */

import { u16 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const END_OF_TEXT = 185;
const CHARACTER_PLANE_BIT = 0x0400;

export function drawTextRun(m) {
  const { regs, mem8 } = m;
  let nextGlyph = regs.hl;
  for (;;) {
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    mem8[regs.de] = glyph;
    mem8[regs.de & ~CHARACTER_PLANE_BIT] = regs.c;
    regs.de |= CHARACTER_PLANE_BIT;
    nextGlyph = u16(nextGlyph + 1);
    advanceCharCursor(m);
  }
  regs.hl = nextGlyph;
}
