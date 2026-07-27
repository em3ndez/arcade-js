// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3d49 — paint one fixed 9-cell HUD/text panel at column 1, row 12.  ROM 0x3d49.
 *
 * Draws a single vertical panel column made of three stacked fields:
 *   - the top cell shows a live value read from a work-RAM slot (it changes as the
 *     game runs),
 *   - the next eight cells show a fixed label — a cap glyph followed by seven glyphs
 *     read out of a ROM table,
 *   - all nine cells are then painted in one colour attribute.
 *
 * It works by first naming the target cell (column 1, row 12) and asking the shared
 * address helpers to turn that into the tilemap offset and the matching colour-RAM /
 * video-RAM write cursors. Then it drives the two copy/fill helpers to stamp the glyphs
 * down the video column — the video cursor is carried forward between them, so the
 * label continues directly below the live value — and finally hands off to the
 * colour-column filler, which paints the whole nine-cell run in the attribute.
 *
 * The address helpers and the colour filler are already decompiled, so they are called
 * directly by name: rowColToTileOffset turns the staged (row, col) into the tilemap
 * offset, deriveTileWriteCursors turns that offset into the colour/video write cursors,
 * and fillColourColumn paints the run. Each reads its inputs from the same work-RAM
 * scratch cells this routine stages, and writes its results back to memory, so no value
 * is passed or returned in registers.
 *
 * The live-value glyph helper 0x3dea is NOW DECOMPILED (copyTileColumn) and called
 * directly, handed its source pointer as an ordinary JS argument — its IX load and stack
 * push are gone. The ROM-label helper 0x3ddb is NOT yet decompiled, so it remains a
 * frozen-oracle boundary reached through the registry: it is bracketed with the return
 * address it expects on the machine stack, and handed its source pointer in ix — the
 * calling convention the oracle uses. When 0x3ddb is later decompiled, that last stack
 * push dissolves into an ordinary call too.
 *
 * Name kept as loc_3d49: it is clearly a fixed-panel painter, but which specific field
 * it draws is not pinned (the label glyphs are ROM tile codes, not decoded), and it is
 * one of a family of near-identical panel painters — below the bar for an English name.
 *
 * Observably memory-equivalent to the frozen oracle — equivalence-3d49.test.js.
 * GATE:     captured at the real attract dispatch (0x3d49 runs during screen setup at
 *           frame 61, reached from loc_3a6f); oracle vs idiomatic diffed on clones of
 *           that entry, plus a sweep of the one state-dependent input (the live top-cell
 *           value at 0x8000). Compared over the work/colour/video RAM the routine paints
 *           plus pc + SP — EXCLUDING the two dead stack-scratch bytes just below the
 *           entry stack pointer (the return-address slot the still-oracle label helper
 *           0x3ddb pushes into, which the direct JS calls no longer model). Teeth twins caught.
 * LIVE-OUT: memory-only — the panel's tilemap + colour cells and the layout scratch
 *           (TILEMAP_OFFSET 0x805a, COLOUR_RAM_CURSOR 0x805e / 0x8060 cursors). The routine hands off to the colour
 *           filler and returns to its caller by a plain JS return; the Z80 tail-jump's
 *           final ret is no longer modelled here, so the gate does one ret on the
 *           candidate to line pc + SP up with the oracle before comparing them.
 * NAMES:    TILE_COL, TILE_ROW, PLOT_RUN_LENGTH from ram.js. 0x8057 kept local (FILL_ATTR) —
 *           ram.js proposes BOARD_MODE for that address, but here it is unambiguously the
 *           panel's colour byte, so a local role name is used instead of a misfit
 *           import. The source pointers 0x8000 / 0x496d are not named in ram.js.
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyTileColumn } from "./copyTileColumn.js";

// The colour attribute every cell of the panel is painted in. ram.js proposes
// BOARD_MODE for 0x8057, but in this routine the byte is the fill colour, not a mode.
const FILL_ATTR = 0x8057;

// Source of the top cell's live value (a work-RAM slot) and of the fixed ROM label.
const VALUE_SOURCE = 0x8000;
const LABEL_SOURCE = 0x496d;

export function loc_3d49(m) {
  const { mem8 } = m;

  // Target cell of the panel: column 1, row 12.
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 12;

  // Turn (row, col) into the tilemap offset for the cell, then derive the
  // colour-RAM and video-RAM write cursors from that offset.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Paint the whole panel in colour attribute 6.
  mem8[FILL_ATTR] = 6;

  // Top field: copy one cell from the live work-RAM value down the video column.
  // (0x3dea is now decompiled (copyTileColumn), called directly with its source pointer.)
  mem8[PLOT_RUN_LENGTH] = 1;
  copyTileColumn(m, VALUE_SOURCE);

  // Label field: fill the next eight cells (cap glyph + seven ROM glyphs), continuing
  // down the same video column from where the value left off. (0x3ddb is not yet
  // decompiled — still the oracle, reached through the registry.)
  mem8[PLOT_RUN_LENGTH] = 8;
  m.regs.ix = LABEL_SOURCE; // the source pointer the fill helper reads
  m.push16(0x3d76);
  m.call(0x3ddb);

  // Colour the full nine-cell run: hand off to the colour-column filler, which paints
  // the whole panel. This is loc_3d49's exit.
  mem8[PLOT_RUN_LENGTH] = 9;
  return fillColourColumn(m);
}
