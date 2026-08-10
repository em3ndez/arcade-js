// SPDX-License-Identifier: GPL-3.0-only
/** stampTwoByTwoTileBlock — stamp one two-cell-square emblem at the cursor and leave the cursor past it.
 *
 * Four consecutive shape codes, counted up from the base the caller supplies, fill the square: the
 * two higher ones on the line the cursor is on and the two lower ones on the line beside it. Every
 * one of the four cells then gets the same colour, written into the plane a fixed distance away,
 * and the four colour writes are made in the reverse of the order the shapes were, walking back
 * across the square. The cursor is stepped once inside each line, so it comes out two places along
 * — the width of the emblem — ready for the next one. LIVE-OUT: memory, eight cells, and the
 * stepped cursor. */

import { u16 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const COLOUR_PLANE_GAP = 0x0400;
const NEXT_LINE = 32;

export function stampTwoByTwoTileBlock(m, base = m.regs.b, colour = m.regs.c) {
  const { regs, mem8 } = m;

  mem8[regs.de] = base + 3;
  regs.de = u16(regs.de - 1);
  mem8[regs.de] = base + 2;
  advanceCharCursor(m);

  mem8[regs.de] = base;
  regs.de = u16(regs.de + 1);
  mem8[regs.de] = base + 1;

  let colourCell = u16(regs.de - COLOUR_PLANE_GAP);
  advanceCharCursor(m);

  mem8[colourCell] = colour;
  colourCell = u16(colourCell - 1);
  mem8[colourCell] = colour;
  colourCell = u16(colourCell + NEXT_LINE);
  mem8[colourCell] = colour;
  mem8[u16(colourCell + 1)] = colour;
}
