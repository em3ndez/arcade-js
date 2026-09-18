// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillColourColumn — paint a vertical run of colour cells with one colour byte, the last step
 * of the colour-column paint pipeline. An upstream step has staged three values in scratch:
 * the colour cursor COLOUR_RAM_CURSOR (the column's top cell), the run length in
 * PLOT_RUN_LENGTH, and the colour byte to stamp. This walks straight down the column — one
 * screen row per step, 32 cells further along the 32-cell-wide map — writing the byte into
 * each cell until the count runs out. Panel, record and HUD painters finish by handing off to
 * this. A count of zero is not a no-op: checked only after the first cell, zero paints 256.
 */

import { COLOUR_RAM_CURSOR, PLOT_RUN_LENGTH } from "./names.js";
export function fillColourColumn(m) {
  const { mem8, mem16 } = m;

  const cursor = mem16[COLOUR_RAM_CURSOR]; // address of the column's top colour cell
  const count = mem8[PLOT_RUN_LENGTH]; // how many cells to paint down the column
  const colour = mem8[0x8057]; // the colour byte to stamp into each cell

  const rows = count === 0 ? 256 : count;

  let cell = cursor;
  for (let i = 0; i < rows; i++) {
    mem8[cell] = colour;
    cell += 32; // one screen row down = 32 cells along the 32-cell-wide map
  }
}
