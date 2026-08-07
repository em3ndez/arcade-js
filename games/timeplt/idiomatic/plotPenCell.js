// SPDX-License-Identifier: GPL-3.0-only
/** plotPenCell — stamp the current glyph, and the current colour beside it, into the one character
 * cell that a row cell and a column cell name, and hand that cell's video-plane address back. Both
 * coordinates fold rather than run on: the row is scaled a byte at a time, so a row past the
 * thirty-second lands back at the top of the plane, and the column is added to the low half of the
 * address alone, so a column past the end of a row wraps within that row. The returned address is
 * load-bearing -- a caller steps a run of cells by subtracting a target from it.
 * LIVE-OUT: the two cells written, plus the address in HL and the colour in A. */

import { u8 } from "../../../core/int.js";

const CHARACTER_PLANE = 0xa400;
const COLOUR_PLANE_BIT = 0x0400;
const PLOT_ROW = 0xa9e4;
const PLOT_COLUMN = 0xa9e6;
const GLYPH = 0xad0b;
const COLOUR = 0xad0c;
const CELLS_PER_ROW = 32;
const ROWS_BEFORE_FOLD = 32;

export function plotPenCell(m) {
  const { mem8, regs } = m;
  const rowStart = (mem8[PLOT_ROW] & (ROWS_BEFORE_FOLD - 1)) * CELLS_PER_ROW;
  const cell = (CHARACTER_PLANE + (rowStart & 0xff00)) | u8(rowStart + mem8[PLOT_COLUMN]);
  mem8[cell] = mem8[GLYPH];
  mem8[cell & ~COLOUR_PLANE_BIT] = mem8[COLOUR];
  regs.hl = cell;
  regs.a = mem8[COLOUR];
}
