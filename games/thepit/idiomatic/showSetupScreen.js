// SPDX-License-Identifier: GPL-3.0-only
/**
 * showSetupScreen — paint the round-setup screen (playfield furniture + two HUD count records)
 * and hold it briefly while a colour band cycles.
 *
 * Run once when a round is (re)started — from the reset epilogue and the per-player teardown. It
 * builds the static start-of-round screen in three passes: first it lays the fixed furniture
 * (blank the screen, board setup, furniture and edge columns, score HUD, colour columns and text
 * panels); second it stamps two marker cells and two COUNT fields, each count's digit tile being
 * its value and its glyph run the plural label when nonzero or a shorter singular label when zero
 * (a count of exactly one also patches a cell above to a singular-form glyph, first field only);
 * third it holds the screen for thirty passes, each advancing the shared accent-colour index and
 * waiting fifteen video frames, so the intro lingers about 450 frames.
 */

import { drawLeftEdgeColumn } from "./drawLeftEdgeColumn.js";
import { redrawScoreHud } from "./redrawScoreHud.js";
import { drawSetupCreditsPanel } from "./drawSetupCreditsPanel.js";
import { drawGameOverText } from "./drawGameOverText.js";
import { drawCopyrightLine } from "./drawCopyrightLine.js";
import { drawBestScoresTodayLabel } from "./drawBestScoresTodayLabel.js";
import { drawRightEdgeColumn } from "./drawRightEdgeColumn.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { waitFrames } from "./waitFrames.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { cycleColumnColour } from "./cycleColumnColour.js";
import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { blankScreen } from "./blankScreen.js";
import {
  COINS_PER_CREDIT_A,
  COINS_PER_CREDIT_B,
  LOOP_COUNTER,
  PLOT_RUN_LENGTH,
  SETUP_COINAGE_A_COUNT_TILE,
  SETUP_COINAGE_A_MARKER_TILE,
  SETUP_COINAGE_A_PLURAL_CELL,
  SETUP_COINAGE_B_COUNT_TILE,
  SETUP_COINAGE_B_MARKER_TILE,
  SETUP_COINAGE_PLURAL_LABEL_GLYPHS,
  SETUP_COINAGE_SINGULAR_LABEL_GLYPHS,
  TILE_COL,
  TILE_ROW,
} from "./names.js";

const HOLD_PASSES = 30; // how many colour-cycle + frame-wait passes the intro holds
const HOLD_FRAMES = 15; // video frames each hold pass waits
const HOLD_COUNTER = LOOP_COUNTER; // where the hold count is stored + drained to 0

// Glyph-run source pointers and lengths for a count field's label. A nonzero count
// gets the longer "plural" run; a zero count gets the shorter "singular" run.
const PLURAL_LABEL = { source: SETUP_COINAGE_PLURAL_LABEL_GLYPHS, run: 7 };
const SINGULAR_LABEL = { source: SETUP_COINAGE_SINGULAR_LABEL_GLYPHS, run: 9 };

/** Stamp one count field: its digit tile, its (col,row) cell, and its label run. */
function stampCountField(m, cell, count, col) {
  const { mem8 } = m;
  mem8[cell] = count; // the digit tile is the count itself
  mem8[TILE_COL] = col;
  mem8[TILE_ROW] = 12;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Nonzero -> plural label; zero -> singular label.
  const label = count === 0 ? SINGULAR_LABEL : PLURAL_LABEL;
  mem8[PLOT_RUN_LENGTH] = label.run;
  copyTileColumn(m, label.source); // copy the glyph-run down the column from its source table
}

export function* showSetupScreen(m) {
  const { mem8 } = m;

  // ── 1. Fixed furniture ──────────────────────────────────────────────────────
  // Blank the screen + run the variant-0 board setup.
  blankScreen(m);

  drawLeftEdgeColumn(m); // draw the left furniture column

  m.push16(0x3a78);
  redrawScoreHud(m); // repaint the score HUD (returns through the stack)

  // Colour a column: column 1 in colour 2.
  fillColourColumnAt(m, 1, 2);

  drawSetupCreditsPanel(m); // fixed text panel at column 1
  drawGameOverText(m); // fixed vertical strip at column 6

  drawCopyrightLine(m); // one full playfield column (tail-returns through the stack)

  drawBestScoresTodayLabel(m); // left edge column (tail-returns through the stack)

  drawRightEdgeColumn(m); // right edge column

  // ── 2. HUD records ──────────────────────────────────────────────────────────
  // A fixed marker cell, then its label run and colour.
  mem8[SETUP_COINAGE_A_MARKER_TILE] = 1;
  mem8[TILE_COL] = 12;
  mem8[TILE_ROW] = 13;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
  mem8[PLOT_RUN_LENGTH] = 6;
  copyTileColumn(m, 0x49b0); // copy the marker's glyph-run from its source table
  fillColourColumnAt(m, 12, 7); // colour column 12 in colour 7

  // First count field (COINS_PER_CREDIT_A), at column 14.
  const countA = mem8[COINS_PER_CREDIT_A];
  stampCountField(m, SETUP_COINAGE_A_COUNT_TILE, countA, 14);
  // When the count is exactly one, patch the cell above to the singular-form glyph.
  if (countA === 1) mem8[SETUP_COINAGE_A_PLURAL_CELL] = 0x24;
  fillColourColumnAt(m, 14, 7); // colour this field's column 14 in colour 7

  // A second fixed marker cell, then its label run and colour.
  mem8[SETUP_COINAGE_B_MARKER_TILE] = 2;
  mem8[TILE_COL] = 18;
  mem8[TILE_ROW] = 12;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
  mem8[PLOT_RUN_LENGTH] = 7;
  copyTileColumn(m, 0x49b1); // copy the marker's glyph-run from its source table
  fillColourColumnAt(m, 18, 3); // colour column 18 in colour 3

  // Second count field (COINS_PER_CREDIT_B), at column 20. No singular patch here.
  const countB = mem8[COINS_PER_CREDIT_B];
  stampCountField(m, SETUP_COINAGE_B_COUNT_TILE, countB, 20);
  fillColourColumnAt(m, 20, 3); // colour this field's column 20 in colour 3

  // ── 3. Hold the intro, cycling the accent colour ────────────────────────────
  mem8[HOLD_COUNTER] = HOLD_PASSES;
  let remaining;
  do {
    // Advance the shared colour index one step and repaint the accent band at column 6.
    cycleColumnColour(m, 6);

    // Hold the screen for a spell.
    yield* waitFrames(m, HOLD_FRAMES);

    remaining = (mem8[HOLD_COUNTER] - 1) & 0xff;
    mem8[HOLD_COUNTER] = remaining;
  } while (remaining !== 0);

  return m.ret();
}
