// SPDX-License-Identifier: GPL-3.0-only
/** drawSlotWithOneGlyph — write one caller-supplied glyph into the cell the cursor names, blank
 * the cell one place BACK from it, give both of those cells the caller's colour, and step the
 * cursor on to the next slot. Crossing into the colour plane and back is done by clearing and
 * then SETTING one bit of the address, so a cursor that has drifted off its own plane is snapped
 * onto it rather than returned to where it came from. LIVE-OUT: the four cells written, and the stepped cursor. */

import { u16 } from "../../../core/int.js";
import { retreatCharCursor } from "./retreatCharCursor.js";

const COLOUR_PLANE_BIT = 0x0400;
const BLANK = 0xf1;

export function drawSlotWithOneGlyph(m) {
  const { regs, mem8 } = m;
  const cell = regs.de;
  const neighbour = u16(cell - 1);
  mem8[cell] = regs.b;
  mem8[neighbour] = BLANK;

  const colourOfNeighbour = neighbour & ~COLOUR_PLANE_BIT;
  mem8[colourOfNeighbour] = regs.c;
  const colourOfCell = u16(colourOfNeighbour + 1);
  mem8[colourOfCell] = regs.c;

  regs.de = colourOfCell | COLOUR_PLANE_BIT;
  retreatCharCursor(m);
}
