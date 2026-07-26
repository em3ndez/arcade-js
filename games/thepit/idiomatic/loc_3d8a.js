// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3d8a — paint one fixed 9-cell vertical strip at column 6, row 12.  ROM 0x3d8a.
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
 * still-oracle copy helper to stamp the nine glyphs down the video column, then tail into
 * the colour-column filler to colour the whole run — whose return unwinds straight back
 * to this routine's caller, so it is loc_3d8a's exit.
 *
 * Name kept as loc_3d8a: it is clearly a fixed-strip painter, but which specific field
 * the nine glyphs spell is not pinned (they are raw ROM tile codes, not decoded), and it
 * is one of a family of near-identical panel painters (the column-1 sibling loc_3d49
 * shares this exact shape) — below the bar to promote to an English name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3d8a.test.js.
 * GATE:     strict — captured at its real attract dispatch (0x3d8a runs once during
 *           screen setup) and diffed oracle-vs-idiomatic on clones of that entry, plus
 *           crafted entries that scribble the tile-scratch and target columns first to
 *           prove the strip is repainted cleanly regardless of prior state. The one
 *           still-oracle copy helper stays a registry hand-off (m.call). The compare
 *           excludes only the two dead stack-scratch bytes just below the entry stack
 *           pointer (see LIVE-OUT); teeth twins caught.
 * LIVE-OUT: memory-only — the strip's nine video cells and nine colour cells, plus the
 *           layout scratch (0x805a offset, 0x805e/0x8060 cursors, 0x8055 count, 0x8057
 *           colour). The exit stack pointer and pc land identical to the oracle too:
 *           the copy helper's return consumes the caller's return address exactly as the
 *           oracle's tail jump does. The only thing that differs is the return-address
 *           word the oracle's balanced internal calls leave below the entry stack
 *           pointer — dead scratch that is never read back (it sits below the exit stack
 *           pointer), so it is excluded from the compare. Every callee reads its inputs
 *           from RAM, so the leftover register file lands identical regardless.
 * NAMES:    TILE_COL, TILE_ROW from ram.js. 0x8057 kept local (FILL_COLOUR) — ram.js
 *           proposes BOARD_MODE for that address, but here it is unambiguously the strip's
 *           fill colour, not a mode, so a local role name is used rather than a misfit
 *           import (the sibling loc_3d49 and the tail filler fillColourColumn keep it hex
 *           for the same reason). 0x8055 (CELL_COUNT, the per-strip cell count) and the
 *           ROM glyph table (0x49a5) are not named in ram.js.
 */

import { TILE_COL, TILE_ROW } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";

// The flat colour every cell of the strip is painted in. ram.js proposes BOARD_MODE for
// 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_COLOUR = 0x8057;

// How many cells the copy/fill helpers write down the column.
const CELL_COUNT = 0x8055;

// Top of the descending ROM glyph table the strip's nine codes are copied from.
const GLYPH_SOURCE = 0x49a5;

export function loc_3d8a(m) {
  const { mem } = m;

  // Target cell of the strip: column 6, row 12.
  mem.write8(TILE_COL, 6);
  mem.write8(TILE_ROW, 12);

  // Turn (row, col) into the tilemap offset, then into the colour-RAM and video-RAM
  // write cursors for that cell.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Stage the nine-cell run: paint it colour 6, nine cells tall.
  mem.write8(FILL_COLOUR, 6);
  mem.write8(CELL_COUNT, 9);

  // Copy the nine glyphs down the video column from the descending ROM table. This
  // helper is not decompiled yet, so it stays a registry hand-off and takes its source
  // pointer through the machine register it reads.
  m.regs.ix = GLYPH_SOURCE;
  m.call(0x3dea);

  // Tail into the colour-column filler to paint all nine cells; its return unwinds
  // straight to our caller, so this is loc_3d8a's exit.
  return fillColourColumn(m);
}
