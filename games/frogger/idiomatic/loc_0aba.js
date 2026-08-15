// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0aba — one-time display-field setup, guarded so it runs only once.
 * Returns immediately once the layout-done guard is set; otherwise sets the guard and two mode
 * cells, blits a 4-tile strip up one column, fills a 15-row run of a single tile down another
 * column, and seeds two scroll/state cells.
 * LIVE-OUT: memory-only.
 */
import {
  loc_842d, loc_803f, loc_83e0, loc_a8bf, loc_2f6e, loc_a8df, loc_83dc, loc_83de,
} from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

const FILL_TILE = 12;
const FILL_ROWS = 15;
const ROW_STRIDE = 32;

export function loc_0aba(m) {
  const { mem8, mem16 } = m;

  if (mem8[loc_842d] !== 0) return; // already laid out
  mem8[loc_842d] = 1;
  mem8[loc_803f] = 3;
  mem8[loc_83e0] = 0;

  copyRunUpTileColumn(m, loc_a8bf, loc_2f6e, 4);

  let cell = loc_a8df;
  for (let row = 0; row < FILL_ROWS; row++) {
    mem8[cell] = FILL_TILE;
    cell = (cell + ROW_STRIDE) & 0xffff;
  }

  mem16[loc_83dc] = 0x3c20;
  mem8[loc_83de] = 96;
}
