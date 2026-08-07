// SPDX-License-Identifier: GPL-3.0-only
/** paintDoubleTile — lay down a two-cell mark at the cursor and step the cursor past it. The pair of codes is consecutive:
 * the caller supplies the lower and the upper is one on from it, the upper going into the cell the cursor names and
 * the lower into the cell below it. Both cells then get the caller's colour, reached by clearing one bit of the
 * address, and the cursor comes back across that bit before it steps. Where the borrow or the carry crosses a plane,
 * the cells the mark and the colour land in part company; the arithmetic is written out so that they can.
 * LIVE-OUT: memory, plus the stepped cursor. */

import { u16, u8 } from "../../../core/int.js";
import { retreatCharCursor } from "./retreatCharCursor.js";

const CHARACTER_PLANE_BIT = 0x0400;

export function paintDoubleTile(m) {
  const { regs, mem8 } = m;
  const cursor = regs.de;
  const below = u16(cursor - 1);
  mem8[cursor] = u8(regs.b + 1);
  mem8[below] = regs.b;

  const colour = below & ~CHARACTER_PLANE_BIT;
  mem8[colour] = regs.c;
  mem8[u16(colour + 1)] = regs.c;

  regs.de = u16(colour + 1) | CHARACTER_PLANE_BIT;
  retreatCharCursor(m);
}
