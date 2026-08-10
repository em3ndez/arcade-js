// SPDX-License-Identifier: GPL-3.0-only
/** paintCreditCountPanel — repaint one two-digit panel field: a single packed byte, in a fixed pen colour,
 * into a fixed pair of cells. Nothing arrives from the caller and nothing is handed back — the
 * colour, the cell the first digit lands in and the byte the digits are read from are constants
 * of this entry, and choosing those three is the whole of it. LIVE-OUT: the cells painted. */

import { paintTwoUnsuppressedDigitsFromByte } from "./paintTwoUnsuppressedDigitsFromByte.js";

const PEN_COLOUR = 16;
const FIRST_CELL = 0xa47f;
const PACKED_BYTE = 0xa986;

export function paintCreditCountPanel(m) {
  const { regs } = m;
  regs.c = PEN_COLOUR;
  regs.de = FIRST_CELL;
  regs.hl = PACKED_BYTE;
  paintTwoUnsuppressedDigitsFromByte(m);
}
