// SPDX-License-Identifier: GPL-3.0-only
/**
 * cyclePanelColumnColour — recolour a fixed nine-cell colour-RAM column, cycling its colour one
 * step each call.  Called from the dig / wall-collision core once its dig probe reads clear, so it
 * runs as a slow background recolour of one playfield column. Each call sets the fill length
 * (PLOT_RUN_LENGTH) to nine cells, advances the colour (BOARD_MODE) one step while holding bit 3
 * clear so it walks the palette codes that never set it, aims at a fixed cell (TILE_COL 6, TILE_ROW
 * 10), and paints the advanced colour down the column via the three shared cell helpers (they turn
 * (column,row) into a tilemap offset, that offset into the write cursors, then paint); no tiles.
 */

import { BOARD_MODE, TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";

export function cyclePanelColumnColour(m) {
  const { mem8 } = m;

  // Nine cells tall — the length the column fill will paint.
  mem8[PLOT_RUN_LENGTH] = 9;

  // Advance the colour one step, but never let bit 3 turn on (cycling clear-bit codes).
  const color = mem8[BOARD_MODE];
  mem8[BOARD_MODE] = (color + 1) & 0xf7;

  // Aim at the fixed target cell: column 6, row 10.
  mem8[TILE_COL] = 6;
  mem8[TILE_ROW] = 10;

  // (column,row) -> tilemap offset -> that cell's colour + video write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Paint the advanced colour down the nine-cell column.
  return fillColourColumn(m);
}
