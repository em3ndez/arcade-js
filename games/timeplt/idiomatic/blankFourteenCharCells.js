// SPDX-License-Identifier: GPL-3.0-only
/** blankFourteenCharCells — blank a fourteen-cell run of the character plane and paint every one
 * of those cells the same colour. It starts at a fixed cell and walks a row at a time in the
 * direction that takes it back up the plane, so the whole run is decided here and no caller can
 * steer it. The run holds one column of the plane and varies the row, which is not the axis it
 * occupies on the glass; the name says how many cells, not where.
 * LIVE-OUT: the twenty-eight cells written. */

import { u16 } from "../../../core/int.js";

const FIRST_CELL = 0xa79f;
const CELLS = 14;
const ONE_ROW_BACK = -32;
const BLANK = 0xf1;
const COLOUR = 0x16;
const COLOUR_PLANE_BIT = 0x0400;

export function blankFourteenCharCells(m) {
  const { mem8 } = m;
  let cell = FIRST_CELL;
  for (let i = 0; i < CELLS; i++) {
    mem8[cell] = BLANK;
    mem8[cell & ~COLOUR_PLANE_BIT] = COLOUR;
    cell = u16(cell + ONE_ROW_BACK);
  }
}
