// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawPlayerLabel — paint one fixed vertical panel (a tile column plus its matching colour column)
 * into the playfield at screen column 1, row 12.
 *
 * The panel is three stacked runs down that column, all using fill byte 7: the top cell takes the
 * current secondary game-state byte, the next seven come from a fixed tile table, and a nine-cell
 * colour column is painted underneath so the strip shares one colour. It runs only while a game is
 * in progress (very likely the started-game HUD readout), a role not confirmed enough to name, so
 * the routine keeps its neutral name. Five shared plot helpers do the work — this routine seeds
 * their shared scratch block (target cell, fill byte, run length, source) and drives all five in
 * order, the last a tail hand-off back to our caller.
 */

import { TILE_COL, TILE_ROW, ACTIVE_PLAYER, PLOT_RUN_LENGTH, BOARD_MODE } from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { copyCappedTileColumn } from "./copyCappedTileColumn.js";

// The shared tile-plotter's scratch parameter block: the plotter ABI, so its cells stay hex here.
const PLOT_FILL_BYTE = BOARD_MODE; // the colour byte the colour-column paint writes

const PANEL_TILE_TABLE = 0x49b1;

export function drawPlayerLabel(m) {
  const { mem8 } = m;

  // Aim the panel at tile column 1, row 12, then derive the tilemap offset and write cursors.
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 12;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  mem8[PLOT_FILL_BYTE] = 7;

  // Top cell: stamp the current secondary game-state byte (copyTileColumn copies one byte down).
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, ACTIVE_PLAYER);

  // Next seven cells: a fixed tile run from the table, called directly with its source pointer.
  mem8[PLOT_RUN_LENGTH] = 7;
  copyCappedTileColumn(m, PANEL_TILE_TABLE);

  // Finally a nine-cell colour column with the fill byte; a tail hand-off back to our caller.
  mem8[PLOT_RUN_LENGTH] = 9;
  return fillColourColumn(m);
}
