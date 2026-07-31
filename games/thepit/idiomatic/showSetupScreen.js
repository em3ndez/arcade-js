// SPDX-License-Identifier: GPL-3.0-only
/**
 * showSetupScreen — paint the round-setup screen (playfield furniture + two HUD count
 * records) and hold it briefly while a colour band cycles.  ROM 0x3a6f.
 *
 * Run once when a round is (re)started — from the reset epilogue and from the
 * per-player teardown. It builds the static screen the player sees at the start of a
 * round in three passes:
 *
 *   1. Lay down the fixed furniture: blank the screen and run the variant-0 board
 *      setup, draw the left furniture column, redraw the score HUD, colour a column,
 *      paint two fixed text panels, then paint one full playfield column and two
 *      edge columns.
 *   2. Stamp four HUD records into the tilemap, each a small on-screen field with its
 *      own tile run and colour:
 *        - a fixed marker cell, then
 *        - a COUNT field showing DSW-derived value 0x804c: its digit tile is that
 *          value, its glyph run is the plural label when the count is nonzero and a
 *          shorter singular label when it is zero, and when the count is exactly one
 *          a cell just above it is patched to a special glyph (the singular form),
 *        - a second fixed marker cell, then
 *        - a second COUNT field showing DSW value 0x804d with the same plural/singular
 *          label rule (this field has no singular patch).
 *   3. Hold the finished screen for thirty passes; each pass advances the shared
 *      colour index one step (cycling the accent band that tints the setup screen)
 *      and waits fifteen video frames, so the intro lingers about 450 frames.
 *
 * The blank/setup 0x4b44 is now the idiomatic blankScreen, a direct JS call. The idiomatic
 * leaves are called directly: the colour fills (fillColourColumnAt), the glyph-run copy
 * (copyTileColumn), and the colour-cycle step (cycleColumnColour) return in plain JS, so
 * they take honest arguments and no stack return. The idiomatic callees that still model
 * their own return through the stack (the HUD redraw, the two column paints, the frame
 * wait) are handed the return address they consume.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3a6f.test.js.
 * GATE:     crafted-entry — the real boot dispatch (0x804c=1, 0x804d=2) plus a sweep
 *           poking 0x804c in {0,1,2} and 0x804d in {0,2} identically on both sides to
 *           reach both count-label arms and the singular-glyph patch; RAM diff outside
 *           the stack-scratch window (pc/SP/registers excluded per the contract). The
 *           thirty frame-waits are driven by one identical per-frame tick hook on both
 *           sides. Reached at round setup (resetStateAndShowSetup, submitHighScoresAndReset), not per-frame attract.
 * LIVE-OUT: memory-only — the painted playfield + HUD tiles (video RAM), their colour
 *           columns (colour RAM), the two count records and the singular patch, and the
 *           hold counter 0x800a drained to 0. Nothing reads a register back afterward.
 * NAMES:    TILE_COL / TILE_ROW / PLOT_RUN_LENGTH, COINS_PER_CREDIT_A / COINS_PER_CREDIT_B
 *           (the two DSW-derived HUD counts, 0x804c / 0x804d) from ram.js. The video/record
 *           cells (0x928c, 0x928e, 0x9292, 0x9294, 0x918e) are kept hex.
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
import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH, COINS_PER_CREDIT_A, COINS_PER_CREDIT_B } from "./ram.js";

const HOLD_PASSES = 30; // how many colour-cycle + frame-wait passes the intro holds
const HOLD_FRAMES = 15; // video frames each hold pass waits
const HOLD_COUNTER = 0x800a; // where the hold count is stored + drained to 0

// Glyph-run source pointers and lengths for a count field's label. A nonzero count
// gets the longer "plural" run; a zero count gets the shorter "singular" run.
const PLURAL_LABEL = { source: 0x496c, run: 7 };
const SINGULAR_LABEL = { source: 0x49ae, run: 9 };

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

  m.push16(0x3a88);
  drawCopyrightLine(m); // one full playfield column (tail-returns through the stack)

  m.push16(0x3a8b);
  drawBestScoresTodayLabel(m); // left edge column (tail-returns through the stack)

  drawRightEdgeColumn(m); // right edge column

  // ── 2. HUD records ──────────────────────────────────────────────────────────
  // A fixed marker cell, then its label run and colour.
  mem8[0x928c] = 1;
  mem8[TILE_COL] = 12;
  mem8[TILE_ROW] = 13;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
  mem8[PLOT_RUN_LENGTH] = 6;
  copyTileColumn(m, 0x49b0); // copy the marker's glyph-run from its source table
  fillColourColumnAt(m, 12, 7); // colour column 12 in colour 7

  // First count field (DSW value 0x804c), at column 14.
  const countA = mem8[COINS_PER_CREDIT_A];
  stampCountField(m, 0x928e, countA, 14);
  // When the count is exactly one, patch the cell above to the singular-form glyph.
  if (countA === 1) mem8[0x918e] = 0x24;
  fillColourColumnAt(m, 14, 7); // colour this field's column 14 in colour 7

  // A second fixed marker cell, then its label run and colour.
  mem8[0x9292] = 2;
  mem8[TILE_COL] = 18;
  mem8[TILE_ROW] = 12;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
  mem8[PLOT_RUN_LENGTH] = 7;
  copyTileColumn(m, 0x49b1); // copy the marker's glyph-run from its source table
  fillColourColumnAt(m, 18, 3); // colour column 18 in colour 3

  // Second count field (DSW value 0x804d), at column 20. No singular patch here.
  const countB = mem8[COINS_PER_CREDIT_B];
  stampCountField(m, 0x9294, countB, 20);
  fillColourColumnAt(m, 20, 3); // colour this field's column 20 in colour 3

  // ── 3. Hold the intro, cycling the accent colour ────────────────────────────
  mem8[HOLD_COUNTER] = HOLD_PASSES;
  let remaining;
  do {
    // Advance the shared colour index one step and repaint the accent band at column 6.
    cycleColumnColour(m, 6);

    // Hold the screen for a spell.
    m.push16(0x3b77);
    yield* waitFrames(m, HOLD_FRAMES);

    remaining = (mem8[HOLD_COUNTER] - 1) & 0xff;
    mem8[HOLD_COUNTER] = remaining;
  } while (remaining !== 0);

  return m.ret();
}
