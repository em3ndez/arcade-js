// SPDX-License-Identifier: GPL-3.0-only
/** paintDigitDroppingLeadingZero — paint one digit, with its colour, into the cell a cursor names — or suppress it.
 *
 * Only the low four bits of the value arriving choose the shape, out of a table in the program
 * image. A value that is not zero always paints and spends the whole suppression allowance at
 * once, so nothing after it can be suppressed. A zero paints only when that allowance is already
 * spent; while it is not, nothing is painted, one unit of allowance goes, and the cursor steps
 * BACK one place — so a caller that steps forward after every digit leaves the blank occupying
 * no space at all. The run pointer the caller was walking is handed back where it was, and the
 * cursor comes back on the glyph side of the two planes whether or not it arrived there.
 * LIVE-OUT: the two cells, the allowance, and the cursor. */

import { u8 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { retreatCharCursor } from "./retreatCharCursor.js";
import { loc_0f06 } from "./names.js";

const DIGIT_BITS = 0x0f;
const CHARACTER_PLANE_BIT = 0x0400;

export function paintDigitDroppingLeadingZero(m, value = m.regs.a, allowance = m.regs.b, colour = m.regs.c) {
  const { regs, mem8 } = m;
  const digit = value & DIGIT_BITS;

  if (digit === 0 && allowance !== 0) {
    regs.b = u8(allowance - 1);
    retreatCharCursor(m);
    return;
  }
  regs.b = 0;

  const runPointer = regs.hl;
  regs.hl = loc_0f06;
  regs.a = digit;
  const glyph = fetchTableByte(m);
  regs.hl = runPointer;

  mem8[regs.de] = glyph;
  mem8[regs.de & ~CHARACTER_PLANE_BIT] = colour;
  regs.de |= CHARACTER_PLANE_BIT;
}
