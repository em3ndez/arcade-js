// SPDX-License-Identifier: GPL-3.0-only
/**
 * rowColToTileOffset — turn a (row, column) tile-cell into a linear tilemap offset.
 * The playfield tilemap is 32 cells wide, so the cell at (row, col) lives at offset
 * row*32 + col from the map's base. This reads the row/column the tile-plotter staged
 * into TILE_ROW and TILE_COL, forms that offset, and stores it as a 16-bit value in
 * TILEMAP_OFFSET for the follow-on step to derive the colour-RAM and video-RAM write
 * cursors. The staged inputs never overflow 16 bits, so it is a plain multiply-add.
 */
import { TILEMAP_OFFSET, TILE_COL, TILE_ROW } from "./names.js";

export function rowColToTileOffset(m) {
  const { mem8, mem16 } = m;

  const row = mem8[TILE_ROW];
  const col = mem8[TILE_COL];

  // 32 cells per tilemap row, so row*32 + col is the cell's linear offset.
  mem16[TILEMAP_OFFSET] = 32 * row + col;
}
