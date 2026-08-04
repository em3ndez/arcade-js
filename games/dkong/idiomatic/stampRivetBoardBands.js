// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampRivetBoardBands — stamp the two-band tile motif into two fixed tilemap rows during
 * 100m-rivet (board 4) setup.
 *
 * A thin wrapper over the shared two-band filler: it points at the first tilemap row base
 * and runs the filler, then points at the second row base and runs it again. Each pass lays
 * tile 0xFD across four consecutive cells, steps over a 28-cell gap, and lays tile 0xFC
 * across four more — so sixteen tilemap cells are written in all, eight per row.
 *
 * Both row bases are fixed constants of this routine and it takes no argument, so its output
 * does not depend on any prior machine state.
 *
 * LIVE-OUT: memory-only — the sixteen tilemap cells.
 */

import { stampTwoTileBands } from "./stampTwoTileBands.js";

// The two tilemap row bases, stamped in this order.
const ROW_BASES = [0x7687, 0x7547];

export function stampRivetBoardBands(m) {
  const { regs } = m;
  for (const base of ROW_BASES) {
    regs.hl = base; // hand the row base to the filler
    stampTwoTileBands(m); // four cells of the first tile, a 28-cell gap, four of the second
  }
}
