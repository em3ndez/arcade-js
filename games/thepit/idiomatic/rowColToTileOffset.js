// SPDX-License-Identifier: GPL-3.0-only
/**
 * rowColToTileOffset — turn a (row, column) tile-cell into a linear tilemap offset.  ROM 0x3dae.
 *
 * The playfield tilemap is 32 cells wide, so the cell at (row, col) lives at the
 * linear offset row*32 + col from the map's base. This reads the row and column
 * the tile-plotter staged, forms that offset, and stores it as a 16-bit value for
 * the follow-on step to turn into the colour-RAM and video-RAM write cursors.
 *
 * The staged row and column are always small enough that row*32 + col never
 * overflows 16 bits, so it is a plain multiply-add — no wrap to model.
 *
 * Called by every panel / record / HUD plotter (loc_47e1, loc_4816, loc_483a,
 * loc_4894, loc_3a6f, loc_4df8) as the first step of placing a run of cells,
 * immediately before the cursor-derivation step that reads the offset back.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3dae.test.js.
 * GATE:     exhaustive over the (row, col) input domain — all 65,536 pairs poked on
 *           a real captured entry, output offset vs the oracle — plus every real
 *           attract dispatch checked on the full contract (only TILEMAP_OFFSET at 0x805a written).
 *           Teeth: a wrong tilemap-width twin. Reached throughout attract's draws.
 * LIVE-OUT: memory-only — the 16-bit tilemap offset TILEMAP_OFFSET at 0x805a. The leftover value
 *           registers are dead: every caller's next act reads the offset back from
 *           memory, never from a register.
 * NAMES:    TILE_ROW / TILE_COL, TILEMAP_OFFSET from ram.js; TILEMAP_OFFSET (0x805a) is the
 *           tilemap-offset output cell the cursor-derivation step reads next.
 */
import { TILEMAP_OFFSET, TILE_COL, TILE_ROW } from "./ram.js";

export function rowColToTileOffset(m) {
  const { mem8, mem16 } = m;

  const row = mem8[TILE_ROW];
  const col = mem8[TILE_COL];

  // 32 cells per tilemap row, so row*32 + col is the cell's linear offset.
  mem16[TILEMAP_OFFSET] = 32 * row + col;
}
