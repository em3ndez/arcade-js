// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyCappedTileColumn — copy a tile-code run down a video-RAM column, but cap the top cell.
 *
 * The capped variant of the plain tile-column copy: same vertical strip (one screen row per step,
 * 32 cells along the 32-cell-wide map), but the TOP cell is forced to a fixed cap tile for a
 * distinct lid. The video cursor and run length (PLOT_RUN_LENGTH) are staged upstream, and the
 * advanced cursor is written back for a follow-up run. The subtlety: the source walk begins one
 * byte BELOW `sourcePtr` (its first byte is the position the cap replaces) and runs backward, so a
 * back-to-front table lands right-way-up; `sourcePtr` is a genuine per-call JS parameter.
 */

import { FILL_TILE_CODE, PLOT_RUN_LENGTH } from "./names.js";


export function copyCappedTileColumn(m, sourcePtr = m.regs.ix) {
  const { mem8, mem16 } = m;

  const count = mem8[PLOT_RUN_LENGTH];
  // Zero means a full 256-cell run (the length is tested only after the first cell).
  const rows = count === 0 ? 256 : count;

  let cell = mem16[0x8060]; // top of the video-RAM column, staged upstream

  // The top cell takes the fixed cap tile; then step one screen row (32 cells) down.
  mem8[cell] = mem8[FILL_TILE_CODE];
  cell += 32;

  // Body cells copy from the source run, which starts one byte below the pointer (the position
  // the cap replaced) and is walked back one byte per cell.
  let src = sourcePtr - 1;
  for (let i = 1; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 32;
    src -= 1;
  }

  // Save the advanced cursor so a follow-up run continues straight down the column.
  mem16[0x8060] = cell;
}
