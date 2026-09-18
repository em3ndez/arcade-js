// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGameOverLabel — stamp the nine-character "GAME OVER" label down its HUD text column.
 *
 * The HUD redraw repaints both players' scores and then, from the count of players still in the
 * game, picks a status label; with no player left active (the game-over state) it draws this one.
 * The label's glyphs are a fixed nine-byte run of character codes spelling "GAME OVER", read from
 * the top downward, so the copy helper is handed the run's last byte. The work is straight-line:
 * name the label's first tile cell (column 1, row 12), turn it into a tilemap offset and the colour
 * and video write cursors, copy the nine glyphs down the video column one row apart, then tint all
 * nine cells one colour as the last act.
 */
import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH, BOARD_MODE } from "./names.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";

// The colour attribute the whole label is painted in (here the byte is a fill colour, not a mode).
const FILL_ATTR = BOARD_MODE;

// Source of the nine "GAME OVER" glyphs; the copy helper walks it downward, handed the last byte.
const GAME_OVER_SOURCE = 0x49a5;

export function drawGameOverLabel(m) {
  const { mem8 } = m;

  // The label's first character sits at screen column 1, row 12.
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 12;

  // Turn that tile cell into its tilemap offset, then into the colour and video write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Colour attribute for the label, and the nine-row run shared by copy and fill.
  mem8[FILL_ATTR] = 6;
  mem8[PLOT_RUN_LENGTH] = 9;

  // Copy the nine glyphs down the video column, then tint all nine cells one colour.
  copyTileColumn(m, GAME_OVER_SOURCE);
  return fillColourColumn(m);
}
