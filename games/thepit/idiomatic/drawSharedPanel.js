// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSharedPanel — lay out a fixed panel: the left edge column and both players' score HUD,
 *            three labelled tile/colour runs, then the right edge and playfield columns.
 *
 * A shared screen-layout routine: two different status screens open by calling this to paint
 * their common fixed skeleton before adding their own variable rows. It runs a fixed script of
 * the shared tile/colour draw helpers, staging the plotter's cursor cells (tile column, row, run
 * length, colour attribute) and a source pointer before each call. In order it:
 *   1. Stamps the fixed left edge column, then repaints both players' score HUD.
 *   2. Places three labelled runs. Each seats a tile cell, turns it into the colour and video
 *      write cursors, then copies a run of glyphs down that video column and tints it:
 *        - 15 glyphs from a label strip at column 7, row 9, one colour;
 *        - one glyph from the live ACTIVE_PLAYER byte at column 9, row 13, then seven cells
 *          beneath it (a fixed cap byte plus a second strip), the eight tinted one colour;
 *        - 15 glyphs from a third label strip at column 13, row 9, then a full colour-column
 *          accent down colour column 13.
 *   3. Stamps the fixed right edge column and the playfield column with its trim.
 * Which specific game screen this skeleton belongs to is not pinned, so the name stays neutral.
 */
import {
  ACTIVE_PLAYER,
  BOARD_MODE,
  PLOT_RUN_LENGTH,
  SHARED_PANEL_COL13_LABEL_GLYPHS,
  SHARED_PANEL_COL7_LABEL_GLYPHS,
  TILE_COL,
  TILE_ROW,
} from "./names.js";
import { drawLeftEdgeColumn } from "./drawLeftEdgeColumn.js";
import { redrawScoreHud } from "./redrawScoreHud.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { copyCappedTileColumn } from "./copyCappedTileColumn.js";
import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { drawBestScoresTodayLabel } from "./drawBestScoresTodayLabel.js";
import { drawRightEdgeColumn } from "./drawRightEdgeColumn.js";

// The colour attribute the colour fills stamp (a staged colour byte, not a mode).
const FILL_ATTR = BOARD_MODE;

export function drawSharedPanel(m) {
  const { mem8 } = m;

  // 1. The panel skeleton: the fixed left edge column, then both players' score HUD.
  drawLeftEdgeColumn(m);
  redrawScoreHud(m);

  // 2a. First labelled run: 15 glyphs at column 7, row 9, one colour attribute.
  seatCell(m, 7, 9);
  mem8[FILL_ATTR] = 0xa5;
  mem8[PLOT_RUN_LENGTH] = 15;
  copyTileColumn(m, SHARED_PANEL_COL7_LABEL_GLYPHS);
  fillColourColumn(m);

  // 2b. Second run at column 9, row 13: one live glyph, then seven cells beneath it, tinted.
  seatCell(m, 9, 13);
  mem8[FILL_ATTR] = 0xa5;
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, ACTIVE_PLAYER); // one dynamic indicator glyph
  mem8[PLOT_RUN_LENGTH] = 7;
  copyCappedTileColumn(m, 0x49b1); // a fixed cap byte, then a second strip
  mem8[PLOT_RUN_LENGTH] = 8;
  fillColourColumn(m);

  // 2c. Third labelled run: 15 glyphs at column 13, row 9, then a colour-column accent.
  seatCell(m, 13, 9);
  mem8[PLOT_RUN_LENGTH] = 15;
  copyTileColumn(m, SHARED_PANEL_COL13_LABEL_GLYPHS);
  fillColourColumnAt(m, 13, 0xa3);

  // 3. The right side: the fixed right edge column, then the playfield column and its trim.
  drawBestScoresTodayLabel(m);
  return drawRightEdgeColumn(m);
}

/** Seat the tile cursor at (column, row) and derive its colour and video write cursors. */
function seatCell(m, column, row) {
  m.mem8[TILE_COL] = column;
  m.mem8[TILE_ROW] = row;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
}
