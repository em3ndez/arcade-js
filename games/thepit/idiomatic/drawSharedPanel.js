// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawSharedPanel — lay out a fixed panel: the left edge column and both players' score HUD,
 *            three labelled tile/colour runs, then the right edge and playfield columns.  ROM 0x3cc1.
 *
 * A shared screen-layout routine: two different status screens (the difficulty
 * status screen and the multi-part labelled display) open by calling this to paint
 * their common fixed skeleton before adding their own variable rows. It runs a fixed
 * script of the shared tile/colour draw helpers, staging the plotter's cursor cells
 * (tile column, tile row, run length, colour attribute) and a source pointer before
 * each call so every element lands where the script places it. In order it:
 *
 *   1. Stamps the fixed left edge column, then repaints both players' score HUD.
 *   2. Places three labelled runs. Each seats a tile cell (column, row), turns it
 *      into the colour-RAM / video-RAM write cursors, then copies a run of glyphs
 *      down that video column and tints it:
 *        - 15 glyphs from a ROM label strip at column 7, row 9, one colour.
 *        - a single glyph copied from the live game-state byte at column 9, row 13,
 *          then seven cells beneath it (a fixed cap byte plus a second ROM strip),
 *          the eight of them tinted one colour.
 *        - 15 glyphs from a third ROM label strip at column 13, row 9, then a full
 *          colour-RAM column accent painted down colour column 13.
 *   3. Stamps the fixed right edge column and the playfield column with its trim.
 *
 * Every draw helper is now decompiled and called directly with no stack framing — the
 * edge/HUD columns, the cursor derivation, both colour-column fills, the tile-column
 * copy, and the capped tile-column copy (0x3ddb, copyCappedTileColumn), which is handed
 * its source pointer as an ordinary JS argument.
 *
 * The role kept a neutral loc_ name: the mechanism (a scripted fixed-panel layout) is
 * clear, but which specific game screen this skeleton belongs to is not yet
 * confidently pinned, and a routine name wants the same corroborated evidence a RAM
 * name does.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3cc1.test.js.
 * GATE:     crafted-entry — this shared layout is only reached from the status-screen
 *           builders, so it does not dispatch in a plain attract run; validated from a
 *           real board-setup machine state (captured at its own first callee's genuine
 *           attract dispatch) over the observable video / colour / work RAM the routine
 *           writes, excluding the dead stack-scratch window. Straight-line with no
 *           input-dependent branch, so one entry exercises the whole path. Teeth twins
 *           caught.
 * LIVE-OUT: memory-only — the edge/HUD/playfield columns and the three labelled runs
 *           in video + colour RAM, plus the plotter cursor/staging cells. No live
 *           registers/flags; the oracle's tail-jump return is modelled by the gate.
 * NAMES:    TILE_COL / TILE_ROW / PLOT_RUN_LENGTH / GAME_STATE2 from ram.js. 0x8057 is
 *           kept local (FILL_ATTR): ram.js proposes BOARD_MODE for it, a mode-index
 *           role that does not describe the colour attribute staged here (matches
 *           drawGameOverLabel / fillColourColumn). The ROM label strips are hex.
 */
import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH, GAME_STATE2 } from "./ram.js";
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

// The colour attribute the colour fills stamp. ram.js proposes BOARD_MODE for 0x8057,
// but here the byte is the panel's colour attribute, not a mode.
const FILL_ATTR = 0x8057;

export function drawSharedPanel(m) {
  const { mem8 } = m;

  // 1. The panel skeleton: the fixed left edge column, then both players' score HUD.
  drawLeftEdgeColumn(m);
  redrawScoreHud(m);

  // 2a. First labelled run: 15 glyphs at column 7, row 9, one colour attribute.
  seatCell(m, 7, 9);
  mem8[FILL_ATTR] = 0xa5;
  mem8[PLOT_RUN_LENGTH] = 15;
  copyTileColumn(m, 0x497b); // ROM label strip
  fillColourColumn(m); // tint the 15 cells

  // 2b. Second run at column 9, row 13: one glyph from the live game-state byte, then
  //     seven cells beneath it, the eight of them tinted one colour.
  seatCell(m, 9, 13);
  mem8[FILL_ATTR] = 0xa5;
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, GAME_STATE2); // one dynamic indicator glyph
  mem8[PLOT_RUN_LENGTH] = 7;
  copyCappedTileColumn(m, 0x49b1); // a fixed cap byte, then a second ROM strip
  mem8[PLOT_RUN_LENGTH] = 8;
  fillColourColumn(m); // tint all eight cells

  // 2c. Third labelled run: 15 glyphs at column 13, row 9, then a colour-column accent.
  seatCell(m, 13, 9);
  mem8[PLOT_RUN_LENGTH] = 15;
  copyTileColumn(m, 0x49f7); // ROM label strip
  fillColourColumnAt(m, 13, 0xa3); // colour column 13, attribute 0xa3

  // 3. The right side of the panel: the fixed right edge column, then the playfield
  //    column and its colour trim. In the oracle this was a tail-jump whose own return
  //    unwound to our caller; called directly it paints and returns here, so it is this
  //    routine's last act.
  drawBestScoresTodayLabel(m);
  return drawRightEdgeColumn(m);
}

/** Seat the tile cursor at (column, row) and derive its colour-RAM / video-RAM write cursors. */
function seatCell(m, column, row) {
  m.mem8[TILE_COL] = column;
  m.mem8[TILE_ROW] = row;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
}
