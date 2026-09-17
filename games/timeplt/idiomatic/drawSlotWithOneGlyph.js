// SPDX-License-Identifier: GPL-3.0-only
/** drawSlotWithOneGlyph — write one caller-supplied glyph into the cell the cursor names, blank
 * the cell one place BACK from it, give both of those cells the caller's colour, and step the
 * cursor on to the next slot. Crossing into the colour plane and back is done by clearing and
 * then SETTING one bit of the address, so a cursor that has drifted off its own plane is snapped
 * onto it rather than returned to where it came from. LIVE-OUT: the four cells written, and the
 * stepped cursor handed back through retreatCharCursor. */

import { u16 } from "../../../core/int.js";
import { retreatCharCursor } from "./retreatCharCursor.js";

const COLOUR_PLANE_BIT = 0x400;
const BLANK = 0xf1;

export function drawSlotWithOneGlyph(m, cell = m.regs.de, glyph = m.regs.b, colour = m.regs.c) {
  const { mem8 } = m;
  const neighbour = u16(cell - 1);
  mem8[cell] = glyph;
  mem8[neighbour] = BLANK;

  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = colour;
  const colourOfCell = u16(colourOfNeighbour + 1);
  mem8[colourOfCell] = colour;

  return retreatCharCursor(m, colourOfCell | COLOUR_PLANE_BIT);
}
