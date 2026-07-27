// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGameOverLabel — stamp the nine-character "GAME OVER" label down its HUD
 * text column.  ROM 0x48e5.
 *
 * The HUD redraw (loc_472c) repaints both players' score displays and then, from
 * the count of players still in the game, picks which status label to draw: with
 * no player left active — player count 0, the game-over state — it draws this one.
 * The label's glyphs are a fixed nine-byte run of character codes in ROM that
 * spell "GAME OVER"; the copy helper reads that run from its top downward, so the
 * pointer it is handed is the address of the run's last byte.
 *
 * The work is four fixed, straight-line steps:
 *   - Name the label's first tile cell: screen column 1, row 12.
 *   - Turn that cell into its tilemap offset (rowColToTileOffset), then into the
 *     matching colour-RAM / video-RAM write cursors (deriveTileWriteCursors).
 *   - Copy the nine "GAME OVER" glyphs down the video column, one tilemap row apart.
 *   - Tint all nine cells in one colour (fillColourColumn), which is this routine's
 *     last act.
 *
 * THE COPY HELPER (ROM 0x3dea) is now the decompiled leaf copyTileColumn: it takes its
 * glyph-source pointer as a plain argument and copies the run down the video column with
 * no stack framing. All four helpers (the three address/fill helpers and the copy leaf)
 * are decompiled, so every one is a direct call — this routine performs no Z80 stack
 * push or oracle hand-off of its own.
 *
 * Memory-equivalent to the frozen oracle — equivalence-48e5.test.js.
 * GATE:     observable equivalence, captured at the one real attract dispatch (0x48e5
 *           runs once in a boot/attract run, reached from loc_472c in the game-over
 *           state, player count 0). Straight-line with no input-dependent branch, so
 *           that single dispatch exercises the whole path; oracle vs idiomatic diffed
 *           on clones of the entry over the work/video/colour RAM the routine writes,
 *           excluding the dead stack-scratch word the oracle's copy-helper CALL parks
 *           just below entry SP (this stack-free routine no longer reproduces it), plus
 *           pc + SP after the routine's return is modelled. Teeth twins caught.
 * LIVE-OUT: memory-only — the nine label cells in video RAM, the nine colour cells,
 *           and the layout scratch (TILEMAP_OFFSET offset, COLOUR_RAM_CURSOR/0x8060 cursors). Unlike the
 *           oracle it does not perform the tail helper's own return, so its exit pc and
 *           stack pointer are the caller's to close; the gate models that one return to
 *           line them up with the oracle before comparing.
 * NAMES:    TILE_COL / TILE_ROW from ram.js — the tile cell fed to the address calc.
 *           0x8057 kept local (FILL_ATTR): ram.js proposes BOARD_MODE for it, but here
 *           it is unambiguously the label's colour byte, so a local role name is used
 *           rather than a misfit import (matches the sibling loc_4894). 0x8055
 *           (PLOT_RUN_LENGTH, the row count) and the ROM glyph source (0x49a5) are not
 *           named in ram.js.
 */
import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";

// The colour attribute the whole label is painted in. ram.js proposes BOARD_MODE for
// 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_ATTR = 0x8057;

// How many cells the copy and the colour fill each write (the nine characters).

// ROM source of the nine "GAME OVER" glyphs (G,A,M,E,space,O,V,E,R at 0x499d..0x49a5).
// The copy helper walks it downward from the top, so it is handed the last byte.
const GAME_OVER_SOURCE = 0x49a5;

export function drawGameOverLabel(m) {
  const { mem8 } = m;

  // The label's first character sits at screen column 1, row 12.
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 12;

  // Turn that tile cell into its tilemap offset, then into the colour-RAM (COLOUR_RAM_CURSOR)
  // and video-RAM (0x8060) write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Colour attribute for the label, and the nine-row run shared by copy and fill.
  mem8[FILL_ATTR] = 6;
  mem8[PLOT_RUN_LENGTH] = 9;

  // Copy the nine "GAME OVER" glyphs down the video column. copyTileColumn (ROM 0x3dea) is
  // the decompiled leaf: it takes the glyph-source pointer as an argument and reads the run
  // backwards from it, so no register marshalling or stack hand-off is needed.
  copyTileColumn(m, GAME_OVER_SOURCE);

  // Tint all nine cells in one colour. In the oracle this was a tail-jump into the colour
  // filler whose own return unwound to the caller; called directly, it paints the column
  // and returns here, so this is drawGameOverLabel's last act.
  return fillColourColumn(m);
}
