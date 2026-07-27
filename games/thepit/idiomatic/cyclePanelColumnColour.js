// SPDX-License-Identifier: GPL-3.0-only
/**
 * cyclePanelColumnColour — recolour a fixed nine-cell colour-RAM column, cycling its colour one
 * step each call.  ROM 0x48c4.
 *
 * Called from the dig / wall-collision core (loc_03e8) once its dig probe reads
 * clear, so it runs as a slow background recolour of one playfield column. Each call:
 *   - Sets the fill length to nine cells (the count the column-fill helper reads).
 *   - Advances the colour value one step while holding bit 3 permanently clear: the
 *     value walks the palette codes that never turn that bit on, wrapping around.
 *   - Aims at a fixed cell — column 6, row 10 — then derives that cell's colour- and
 *     video-RAM write cursors and paints the advanced colour straight down the
 *     nine-cell column in colour RAM.
 * Unlike its sibling column routines it copies no tile graphics — it only recolours.
 *
 * The three steps are the shared cell helpers: rowColToTileOffset turns the target
 * (column, row) into a tilemap offset, deriveTileWriteCursors turns that offset into
 * the colour- and video-RAM cursors, and fillColourColumn paints the colour down the
 * column. Each reads the bytes seated above straight from RAM, so they take no
 * arguments and hand nothing back — their whole product is the recoloured colour-RAM
 * column, which is also this routine's only live-out.
 *
 * Memory-equivalent to the frozen oracle — equivalence-48c4.test.js.
 * GATE:     observable — real captured boot/attract dispatches (loc_03e8 fires it 26x
 *           in a 1200-frame run, first during boot); oracle vs this leave identical
 *           work / colour RAM outside the dead stack-scratch window. Teeth: a dropped
 *           colour advance is caught at BOARD_MODE.
 * LIVE-OUT: memory-only — the recoloured colour-RAM column. The oracle's exit
 *           registers, flags, and Z80 return path (SP/pc) are dead scratch a plain JS
 *           call replaces.
 * NAMES:    BOARD_MODE (0x8057, cycled here as the column's colour code), TILE_COL
 *           (0x8058), TILE_ROW (0x8059) from ram.js. Hex-kept: 0x8055 (fill length,
 *           unnamed).
 */

import { BOARD_MODE, TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";

export function cyclePanelColumnColour(m) {
  const { mem8 } = m;

  // Nine cells tall — the length the column fill will paint.
  mem8[PLOT_RUN_LENGTH] = 9;

  // Advance the colour one step, but never let bit 3 turn on: the value cycles
  // through the palette codes that keep that bit clear.
  const color = mem8[BOARD_MODE];
  mem8[BOARD_MODE] = (color + 1) & 0xf7;

  // Aim at the fixed target cell: column 6, row 10.
  mem8[TILE_COL] = 6;
  mem8[TILE_ROW] = 10;

  // (column,row) -> tilemap offset -> that cell's colour + video write cursors.
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Paint the advanced colour down the nine-cell column.
  return fillColourColumn(m);
}
