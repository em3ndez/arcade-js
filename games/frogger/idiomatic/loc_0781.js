// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0781 — fill a 22-wide by 32-tall tilemap block with a fixed tile.
 *
 * Writes 22 cells per row across 32 rows from a fixed base, skipping 10 cells between rows.
 * LIVE-OUT: memory-only.
 */
import { loc_a808 } from "./names.js";

const FILL_TILE = 16;
const ROWS = 32;
const CELLS_PER_ROW = 22;
const ROW_SKIP = 10;

export function loc_0781(m) {
  const { mem8 } = m;
  let p = loc_a808;
  for (let row = 0; row < ROWS; row++) {
    for (let cell = 0; cell < CELLS_PER_ROW; cell++) {
      mem8[p] = FILL_TILE;
      p = (p + 1) & 0xffff;
    }
    p = (p + ROW_SKIP) & 0xffff;
  }
}
