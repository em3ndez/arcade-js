// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditsDisplay — paint one fixed 9-cell HUD/text panel at column 6, row 10.
 * A periodic redraw of one fixed panel: a vertical column of two stacked fields — the top cell
 * shows a live value from a work-RAM slot, the next eight a fixed label (a cap glyph plus seven
 * table glyphs). It names the target cell, derives the tilemap offset and write cursors, drives
 * two copy/fill helpers down the video column (the cursor carried forward so the label sits
 * below the value), then tail-calls the colour filler. Unlike its siblings it does NOT reset the
 * count before that fill, so the colour run covers the label's eight cells, not the full nine —
 * the live top cell keeps its prior colour. Which field it draws is not pinned.
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH, CREDIT_COUNT } from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { copyCappedTileColumn } from "./copyCappedTileColumn.js";

// The colour attribute the colour fill paints (a staged colour byte, not a mode).
const FILL_ATTR = 0x8057;

// Source of the fixed label glyphs. (The top cell's live value comes from CREDIT_COUNT.)
const LABEL_SOURCE = 0x496d;

export function drawCreditsDisplay(m) {
  const { mem8 } = m;

  // Target cell of the panel: column 6, row 10.
  mem8[TILE_COL] = 6;
  mem8[TILE_ROW] = 10;

  // Turn (row, col) into the tilemap offset, then derive the colour/video write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  mem8[FILL_ATTR] = 150;

  // Top field: copy one cell from the live CREDIT_COUNT value down the video column.
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, CREDIT_COUNT);

  // Label field: fill the next eight cells (cap glyph + seven glyphs), continuing the column.
  mem8[PLOT_RUN_LENGTH] = 8;
  copyCappedTileColumn(m, LABEL_SOURCE);

  // Hand off to the colour filler with the count of eight still in place, so it tints those
  // eight cells; its result is this routine's.
  return fillColourColumn(m);
}
