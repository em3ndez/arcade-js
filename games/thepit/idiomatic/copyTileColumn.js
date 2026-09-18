// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyTileColumn — copy a stored run of tile codes straight down a video-RAM column. The
 * counterpart to the colour fill (fillColourColumn): where that stamps one repeated colour
 * down a colour-RAM column, this copies DISTINCT character codes down the matching video-RAM
 * column, so a stored graphic lands as a vertical strip. The top cell and run length
 * (PLOT_RUN_LENGTH) are staged upstream; `sourcePtr` is a table read one byte per cell BACKWARDS
 * while the destination steps a screen row down (32 cells), so a back-to-front table lands upright.
 */

import { PLOT_RUN_LENGTH } from "./names.js";

export function copyTileColumn(m, sourcePtr = m.regs.ix) {
  const { mem8, mem16 } = m;

  const count = mem8[PLOT_RUN_LENGTH];
  // Zero means a full 256-cell run (the length is tested only after the first cell).
  const rows = count === 0 ? 256 : count;

  let cell = mem16[0x8060];
  let src = sourcePtr;

  for (let i = 0; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 32; // one screen row down = 32 cells along the 32-cell-wide map
    src -= 1; // the source run is walked back one byte per cell
  }

  // Save the advanced cursor so a follow-up run continues straight down the column.
  mem16[0x8060] = cell;
}
