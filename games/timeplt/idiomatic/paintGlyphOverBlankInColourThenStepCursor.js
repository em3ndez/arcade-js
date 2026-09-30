// SPDX-License-Identifier: GPL-3.0-only
/** paintGlyphOverBlankInColourThenStepCursor — lay a two-cell piece into the character plane at the cursor, then step the cursor
 * one place along the line. The cell the cursor names takes the caller's glyph; the address one
 * BELOW it takes the blanking glyph; and both take the caller's colour in the plane beside them.
 * Coming back from the colour plane is a SET, so the cursor is left on the glyph side whether or
 * not it arrived there, and one arriving on the colour side writes its glyph there instead. The
 * pointer the caller was holding is untouched.
 * The cursor is then stepped one cell back along the line.
 * LIVE-OUT: the four cells written and the stepped cursor, returned. */

import { u16 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const BLANK_GLYPH = 241;
const CHARACTER_PLANE_BIT = 0x400;

export function paintGlyphOverBlankInColourThenStepCursor(m, cursor = m.regs.de, glyph = m.regs.b, colour = m.regs.c) {
  const { mem8 } = m;
  mem8[cursor] = glyph;
  cursor = u16(cursor - 1);
  mem8[cursor] = BLANK_GLYPH;

  cursor = cursor & ~CHARACTER_PLANE_BIT;
  mem8[cursor] = colour;
  cursor = u16(cursor + 1);
  mem8[cursor] = colour;
  cursor = cursor | CHARACTER_PLANE_BIT;

  return advanceCharCursor(m, cursor);
}
