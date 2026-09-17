// SPDX-License-Identifier: GPL-3.0-only
/** paintGlyphOverBlankInColourThenStepCursor — lay a two-cell piece into the character plane at the cursor, then step the cursor
 * one place along the line. The cell the cursor names takes the caller's glyph; the address one
 * BELOW it takes the blanking glyph; and both take the caller's colour in the plane beside them.
 * Coming back from the colour plane is a SET, so the cursor is left on the glyph side whether or
 * not it arrived there, and one arriving on the colour side writes its glyph there instead. The
 * pointer the caller was holding is untouched.
 * The cursor is then stepped one cell back along the line; that step is an eight-bit subtract of
 * the stride from the cursor's low byte, and it leaves the accumulator holding that stepped low
 * byte and the flags of the subtract — or, when the low byte borrowed, of the high-byte decrement,
 * the borrow standing as carry.
 * LIVE-OUT: the four cells written, the stepped cursor, and the accumulator and flags that step set. */

import { u8, u16 } from "../../../core/int.js";
import { F_S, F_Z, F_N, F_F3, F_F5, F_C, F_H, F_PV } from "../../../core/cpu/z80.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const BLANK_GLYPH = 241;
const CHARACTER_PLANE_BIT = 0x400;
const CELL_STRIDE = 0x20;

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

  // step one cell back along the line, and reproduce the accumulator and flags that step leaves.
  const low = cursor & 0xff;
  const diff = low - CELL_STRIDE;
  const av = u8(diff);
  advanceCharCursor(m, cursor);
  let fv =
    (av & 0x80 ? F_S : 0) |
    (av === 0 ? F_Z : 0) |
    (av & (F_F3 | F_F5)) |
    F_N |
    (diff < 0 ? F_C : 0) |
    (((low ^ CELL_STRIDE ^ av) & 0x10) ? F_H : 0) |
    (((low ^ CELL_STRIDE) & (low ^ av) & 0x80) ? F_PV : 0);
  if (diff < 0) {
    const high = u8((cursor >> 8) - 1);
    fv =
      F_C |
      (high & 0x80 ? F_S : 0) |
      (high === 0 ? F_Z : 0) |
      (high & (F_F3 | F_F5)) |
      F_N |
      ((high & 0x0f) === 0x0f ? F_H : 0) |
      (high === 0x7f ? F_PV : 0);
  }
  return (m.regs.a = av, m.regs.f = fv);
}
