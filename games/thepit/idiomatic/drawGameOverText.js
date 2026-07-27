// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGameOverText — paint one fixed 9-cell vertical strip at column 6, row 12.  ROM 0x3d8a.
 *
 * Draws a single nine-cell column of the screen: it copies a run of nine glyph codes
 * out of a fixed ROM table straight down the video column, then paints the same nine
 * cells one flat colour. The glyphs come from a table that is walked backwards, so the
 * top cell of the strip is the last byte of the table and each cell below steps one
 * byte earlier — the strip reads top-to-bottom as the table reads back-to-front.
 *
 * It works the way every fixed panel does: name the target cell (column 6, row 12),
 * ask the shared address helpers to turn that into the tilemap offset and the matching
 * colour-RAM / video-RAM write cursors, stage the glyph count and fill colour, drive the
 * copy helper to stamp the nine glyphs down the video column, then tail into
 * the colour-column filler to colour the whole run — whose return unwinds straight back
 * to this routine's caller, so it is drawGameOverText's exit.
 *
 * Name kept as drawGameOverText: it is clearly a fixed-strip painter, but which specific field
 * the nine glyphs spell is not pinned (they are raw ROM tile codes, not decoded), and it
 * is one of a family of near-identical panel painters (the column-1 sibling drawSetupCreditsPanel
 * shares this exact shape) — below the bar to promote to an English name.
 *
 * Memory-equivalent to the frozen oracle on the observable RAM — equivalence-3d8a.test.js.
 * GATE:     memory-equivalence — captured at its real attract dispatch (0x3d8a runs once
 *           during screen setup) and diffed oracle-vs-idiomatic on clones of that entry,
 *           plus crafted entries that scribble the tile-scratch and target columns first
 *           to prove the strip is repainted cleanly regardless of prior state. All four
 *           plot helpers are now decompiled and called directly, dropping the Z80
 *           return-address pushes and the tail ret, so pc, SP, the value registers and the
 *           dead stack-scratch window below the entry SP legitimately differ and are
 *           excluded; the painted video / colour RAM is compared byte-for-byte. Teeth
 *           twins (wrong fill colour, wrong cell count, a corrupted painted cell) caught.
 * LIVE-OUT: memory-only — the strip's nine video cells and nine colour cells, plus the
 *           layout scratch (TILEMAP_OFFSET 0x805a, cursors COLOUR_RAM_CURSOR 0x805e / 0x8060,
 *           0x8055 count, 0x8057 colour). No caller reads a returned register (the residual registers are dead
 *           ABI), and the decompiled helpers take no leftover-register input — copyTileColumn
 *           is handed its source pointer as an argument, the rest read the shared scratch
 *           block — so the leftover register file is irrelevant to the compare. The exit pc
 *           and stack pointer are emulation artifacts, not live-out, and are excluded.
 * NAMES:    TILE_COL, TILE_ROW from ram.js. 0x8057 kept local (FILL_COLOUR) — ram.js
 *           proposes BOARD_MODE for that address, but here it is unambiguously the strip's
 *           fill colour, not a mode, so a local role name is used rather than a misfit
 *           import (the sibling drawSetupCreditsPanel and the tail filler fillColourColumn keep it hex
 *           for the same reason). 0x8055 (PLOT_RUN_LENGTH, the per-strip cell count) and the
 *           ROM glyph table (0x49a5) are not named in ram.js.
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";

// The flat colour every cell of the strip is painted in. ram.js proposes BOARD_MODE for
// 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_COLOUR = 0x8057;

// How many cells the copy/fill helpers write down the column.

// Top of the descending ROM glyph table the strip's nine codes are copied from.
const GLYPH_SOURCE = 0x49a5;

export function drawGameOverText(m) {
  const { mem8 } = m;

  // Target cell of the strip: column 6, row 12.
  mem8[TILE_COL] = 6;
  mem8[TILE_ROW] = 12;

  // Turn (row, col) into the tilemap offset, then into the colour-RAM and video-RAM
  // write cursors for that cell.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Stage the nine-cell run: paint it colour 6, nine cells tall.
  mem8[FILL_COLOUR] = 6;
  mem8[PLOT_RUN_LENGTH] = 9;

  // Copy the nine glyphs down the video column from the descending ROM table.
  // copyTileColumn walks the table backwards, one code per cell, and is handed its
  // source pointer as an argument.
  copyTileColumn(m, GLYPH_SOURCE);

  // Tail into the colour-column filler to paint all nine cells; its return unwinds
  // straight to our caller, so this is drawGameOverText's exit.
  return fillColourColumn(m);
}
