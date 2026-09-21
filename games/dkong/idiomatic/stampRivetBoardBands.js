// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampRivetBoardBands — stamp the two-band tile motif into two fixed tilemap rows during
 * 100m-rivet (board 4) setup: run the shared two-band filler at each of the two fixed row bases
 * (each pass lays four cells of one tile, a 28-cell gap, four of another). LIVE-OUT: memory-only.
 */

import { stampTwoTileBands } from "./stampTwoTileBands.js";
import { RIVET_BOARD_BAND_BASE, RIVET_BAND_ROW_BASE_B } from "./names.js";

// The two tilemap row bases, stamped in this order.
const ROW_BASES = [RIVET_BOARD_BAND_BASE, RIVET_BAND_ROW_BASE_B];

export function stampRivetBoardBands(m) {
  for (const base of ROW_BASES) {
    stampTwoTileBands(m, base); // four cells of the first tile, a 28-cell gap, four of the second
  }
}
