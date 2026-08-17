// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTilemapBlock28x32 — fill a 28-wide by 32-tall tilemap block with a fixed tile.
 *
 * Writes 28 cells per row across 32 rows from a fixed base, skipping 4 cells between rows.
 * LIVE-OUT: memory-only.
 */
import { TILEMAP_FILL_BASE_28X32 } from "./names.js";

const FILL_TILE = 16;
const ROWS = 32;
const CELLS_PER_ROW = 28;
const ROW_SKIP = 4;

export function fillTilemapBlock28x32(m) {
  const { mem8 } = m;
  let p = TILEMAP_FILL_BASE_28X32;
  for (let row = 0; row < ROWS; row++) {
    for (let cell = 0; cell < CELLS_PER_ROW; cell++) {
      mem8[p] = FILL_TILE;
      p = p + 1;
    }
    p = p + ROW_SKIP;
  }
}
