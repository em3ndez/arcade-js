// SPDX-License-Identifier: GPL-3.0-only
/** paintDoubleTile — lay down a two-cell mark at the cursor and step the cursor past it. The pair of codes is consecutive:
 * the caller supplies the lower and the upper is one on from it, the upper going into the cell the cursor names and
 * the lower into the cell below it. Both cells then get the caller's colour, reached by clearing one bit of the
 * address, and the cursor comes back across that bit before it steps. Where the borrow or the carry crosses a plane,
 * the cells the mark and the colour land in part company; the arithmetic is written out so that they can.
 * LIVE-OUT: memory, plus the stepped cursor. */

import { u16, u8 } from "../../../core/int.js";
import { retreatCharCursor } from "./retreatCharCursor.js";

const CHARACTER_PLANE_BIT = 0x400;

export function paintDoubleTile(m, cursor = m.regs.de, code = m.regs.b, colour = m.regs.c) {
  const { mem8 } = m;
  const below = u16(cursor - 1);
  mem8[cursor] = u8(code + 1);
  mem8[below] = code;

  const colourCell = below & ~CHARACTER_PLANE_BIT;
  mem8[colourCell] = colour;
  mem8[u16(colourCell + 1)] = colour;

  return retreatCharCursor(m, u16(colourCell + 1) | CHARACTER_PLANE_BIT);
}
