// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawMenLeftPanel — paint one HUD/text panel at column 5, in one of two variants.
 *
 * The look is chosen from the live work-RAM byte MEN_LEFT. The column is always at
 * column 5. Default variant (the byte is anything but 1): a nine-glyph label at row 11,
 * then one more cell showing the live byte, the whole ten-cell run in one colour.
 * Alternate variant (the byte equals 1): an eight-glyph label at row 12, the eight-cell
 * run in a neighbouring colour, no live-value cell. Like the sibling panel painters it names
 * the target cell, turns it into the tilemap offset, derives the write cursors, drives the copy
 * helper to stamp glyphs down the video column (the shared cursor advances between fields, so
 * each continues below the last), then fills the run's colour. The name is provisional: which
 * field it draws and what the live byte counts are not pinned, and it is one of a near family.
 */

import {
  BOARD_MODE,
  MEN_LEFT,
  MEN_LEFT_ALT_LABEL_GLYPHS,
  MEN_LEFT_DEFAULT_LABEL_GLYPHS,
  PLOT_RUN_LENGTH,
  TILE_COL,
  TILE_ROW,
} from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";

// The colour attribute the panel is painted in (here the byte is the fill colour, not a mode).
const FILL_ATTR = BOARD_MODE;

// Glyph sources for the two labels (walked backwards by the copy helper).

export function drawMenLeftPanel(m) {
  const { mem8 } = m;

  mem8[TILE_COL] = 5; // the panel column is always 5

  if (mem8[MEN_LEFT] === 1) {
    // Alternate variant: an eight-glyph label at row 12, no live-value cell.
    mem8[TILE_ROW] = 12;

    rowColToTileOffset(m);
    deriveTileWriteCursors(m);

    mem8[FILL_ATTR] = 150;

    // The eight-glyph label, stamped down the video column by the copy helper.
    mem8[PLOT_RUN_LENGTH] = 8;
    copyTileColumn(m, MEN_LEFT_ALT_LABEL_GLYPHS);

    // Colour the full eight-cell run; this is drawMenLeftPanel's exit.
    return fillColourColumn(m);
  }

  // Default variant: a nine-glyph label at row 11, then the live value below it.
  mem8[TILE_ROW] = 11;

  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  mem8[FILL_ATTR] = 151;

  // The nine-glyph label field, stamped by the copy helper.
  mem8[PLOT_RUN_LENGTH] = 9;
  copyTileColumn(m, MEN_LEFT_DEFAULT_LABEL_GLYPHS);

  // One more cell: the live value itself, continuing down the same video column.
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, MEN_LEFT);

  // Colour the full ten-cell run; this is drawMenLeftPanel's exit.
  mem8[PLOT_RUN_LENGTH] = 10;
  return fillColourColumn(m);
}
