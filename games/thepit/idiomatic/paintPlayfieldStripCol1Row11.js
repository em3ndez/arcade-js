// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintPlayfieldStripCol1Row11 — paint one fixed vertical tile strip of the round's static playfield,
 * then its matching colour column.
 *
 * Round setup draws the static playfield by calling a run of these strip painters. This one
 * positions a tile-cell cursor at column 1, row 11, resolves that cell's tilemap and colour
 * addresses, then lays a 10-cell vertical run down the column: the top cell takes a fixed cap
 * byte and the nine below it are walked backwards through a tile table (the tilemap fill), then
 * the colour column paints the same 10 cells with a single colour value. Cursor placement,
 * address resolve, tilemap fill and colour fill are all sibling helpers. Which specific playfield
 * element this strip is has not been earned, so the name stays coordinate-descriptive.
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH, BOARD_MODE } from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyCappedTileColumn } from "./copyCappedTileColumn.js";

// Tile table the tilemap fill walks (backwards) for every cell below the cap.
const STRIP_SOURCE_TABLE = 0x494f;
// Paint scratch shared with the fill helpers: the colour value painted down the column.
const COLOUR_FILL = BOARD_MODE;

export function paintPlayfieldStripCol1Row11(m) {
  const { mem8 } = m;

  // Position the cursor at column 1, row 11, then resolve the tilemap offset and write cursors.
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 11;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Colour value 0, a 10-cell run, then paint the tilemap strip (cap on top, table-walked below).
  mem8[COLOUR_FILL] = 0;
  mem8[PLOT_RUN_LENGTH] = 10;
  copyCappedTileColumn(m, STRIP_SOURCE_TABLE);

  // Paint the matching 10-cell colour column; the call returns here, so we return to our caller.
  return fillColourColumn(m);
}
