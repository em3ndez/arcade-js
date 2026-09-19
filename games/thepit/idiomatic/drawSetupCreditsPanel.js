// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSetupCreditsPanel — paint one fixed 9-cell HUD/text panel at column 1, row 12. A single
 * vertical panel column of three stacked fields: the top cell shows a live value from a work-RAM
 * slot (it changes as the game runs), the next eight show a fixed label (a cap glyph plus seven
 * glyphs from a data table), and all nine are then painted one colour. It names the target cell,
 * asks the shared address helpers for the tilemap offset and the colour-RAM / video-RAM write
 * cursors, drives the two copy/fill helpers down the video column (cursor carried forward between
 * them), and hands off to the colour-column filler to paint the whole run.
 */

import {
  BOARD_MODE,
  CREDIT_COUNT,
  CREDIT_LABEL_GLYPHS,
  PLOT_RUN_LENGTH,
  TILE_COL,
  TILE_ROW,
} from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { copyCappedTileColumn } from "./copyCappedTileColumn.js";

// The colour attribute every cell of the panel is painted in (here the byte is a fill colour, not a mode).
const FILL_ATTR = BOARD_MODE;

// Source of the fixed label glyphs. (The top cell's live value comes from CREDIT_COUNT.)

export function drawSetupCreditsPanel(m) {
  const { mem8 } = m;

  // Target cell of the panel: column 1, row 12.
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 12;

  // Turn (row, col) into the tilemap offset, then derive the colour-RAM and video-RAM write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Paint the whole panel in colour attribute 6.
  mem8[FILL_ATTR] = 6;

  // Top field: copy one cell from the live work-RAM value down the video column.
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, CREDIT_COUNT);

  // Label field: fill the next eight cells (cap glyph + seven label glyphs), continuing down the same column.
  mem8[PLOT_RUN_LENGTH] = 8;
  copyCappedTileColumn(m, CREDIT_LABEL_GLYPHS);

  // Colour the full nine-cell run: hand off to the colour-column filler. This is our exit.
  mem8[PLOT_RUN_LENGTH] = 9;
  return fillColourColumn(m);
}
