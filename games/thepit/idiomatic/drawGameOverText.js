// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGameOverText — paint one fixed 9-cell vertical strip at column 6, row 12.
 * Copies a run of nine glyph codes from a fixed table straight down the video column, then
 * paints those nine cells one flat colour. The glyph table is walked backwards, so the top
 * cell is the table's last byte and each cell below steps one byte earlier — the strip reads
 * top-to-bottom as the table reads back-to-front. It names the target cell, derives the
 * tilemap offset and write cursors, stages the count and colour, copies the glyphs, then tails
 * into the colour-column filler whose return is this routine's exit. Which field the nine
 * glyphs spell is not pinned, so the name stays neutral.
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH, BOARD_MODE } from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";

// The flat colour every cell of the strip is painted in (a staged colour byte, not a mode).
const FILL_COLOUR = BOARD_MODE;

// Top of the descending glyph table the strip's nine codes are copied from.
const GLYPH_SOURCE = 0x49a5;

export function drawGameOverText(m) {
  const { mem8 } = m;

  // Target cell of the strip: column 6, row 12.
  mem8[TILE_COL] = 6;
  mem8[TILE_ROW] = 12;

  // Turn (row, col) into the tilemap offset, then the colour and video write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Stage the nine-cell run: paint it colour 6, nine cells tall.
  mem8[FILL_COLOUR] = 6;
  mem8[PLOT_RUN_LENGTH] = 9;

  // Copy the nine glyphs down the video column; copyTileColumn walks the table backwards.
  copyTileColumn(m, GLYPH_SOURCE);

  // Tail into the colour-column filler to paint all nine cells; its return unwinds to our caller.
  return fillColourColumn(m);
}
