// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4816 — paint one fixed vertical tile strip of the round's static playfield,
 * then its matching colour column.  ROM 0x4816.
 *
 * Round setup (loc_02e1 / loc_02ca) draws the static playfield by calling a run of
 * these strip painters. This one positions a tile-cell cursor at column 1, row 11,
 * resolves that cell's tilemap and colour addresses, then lays a 10-cell vertical
 * run down the column:
 *
 *   - The strip's top cell takes a fixed cap byte and the nine cells below it are
 *     walked backwards through a ROM tile table at 0x494f (the tilemap fill).
 *   - The colour column then paints the same 10 cells with a single colour value (0).
 *
 * The cursor placement, address resolve and colour-column fill are decompiled siblings,
 * called directly: rowColToTileOffset stages the tilemap offset, deriveTileWriteCursors
 * turns it into the colour-RAM / video-RAM write cursors, and fillColourColumn paints
 * the colour run. The tilemap fill at 0x3ddb is still the frozen oracle (it has no
 * idiomatic form yet), so it is reached across the boundary: the pushed word beside the
 * call is the return address its own ret pops, and this hardware's stack lives in the
 * work RAM the gate compares, so the pushed/popped bytes must land where the oracle
 * leaves them. Its one register live-in is the ROM source-table pointer it walks; every
 * cursor, count and fill byte is written straight to memory.
 *
 * NAME kept loc_4816: the mechanism (paint a fixed tile strip + colour column) is
 * clear, but this is one of a ~9-routine family (loc_472c..loc_48e5) that each paint a
 * different fixed strip, and which playfield element this particular one is has not
 * been earned — an English name would over-claim one strip's identity.
 *
 * Memory-equivalent to the frozen oracle on the observable RAM — equivalence-4816.test.js.
 * GATE:     crafted-entry. loc_4816 is round-setup, NOT reached in attract, so it is
 *           validated on real machine states captured at a shared callee's dispatch
 *           (loc_3dae) during a boot/attract run. Because the decompiled helpers are
 *           plain calls with no machine stack frame, this routine no longer reproduces
 *           their return-address pushes and no longer runs the oracle's tail ret, so the
 *           gate diffs the observable RAM the routine paints + pc + SP (after modelling
 *           the return with one ret), excluding the dead stack-scratch window and the
 *           declared-dead value registers. Teeth = a wrong strip height.
 * LIVE-OUT: memory-only — the painted tilemap strip + colour column and the paint
 *           scratch (cursor 0x8058/0x8059, offset/address words 0x805a/0x805e/0x8060,
 *           count 0x8055, fill byte 0x8057). The caller reloads its own register from
 *           RAM and consumes nothing this leaves.
 * NAMES:    TILE_COL (0x8058), TILE_ROW (0x8059) from ram.js. Kept hex: 0x8057 is the
 *           colour fill byte here — ram.js reads this scratch as BOARD_MODE for a
 *           different routine family, so naming it that here would mislead; 0x8055 is
 *           the strip cell count (unnamed); 0x494f is a ROM tile-table address.
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";

// ROM tile table the tilemap fill walks (backwards) for every cell below the cap.
const STRIP_SOURCE_TABLE = 0x494f;
// Paint scratch shared with the fill helpers: the colour value painted down the
// column, and the number of cells in the vertical run.
const COLOUR_FILL = 0x8057;

export function loc_4816(m) {
  const { regs, mem8 } = m;

  // Position the tile-cell cursor at column 1, row 11, then resolve that cell's
  // tilemap offset (0x805a) and from it the colour-RAM and video-RAM write cursors
  // (0x805e / 0x8060).
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 11;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Colour value 0, a 10-cell run, source table pointer, then paint the tilemap strip
  // (top cell = the fixed cap, the nine below walked back through the ROM table). The
  // tilemap fill is still the frozen oracle, so it is called across the boundary: the
  // pushed word is the return address its ret pops, and the source pointer is its one
  // register live-in.
  mem8[COLOUR_FILL] = 0;
  mem8[PLOT_RUN_LENGTH] = 10;
  regs.ix = STRIP_SOURCE_TABLE;
  m.push16(0x4837);
  m.call(0x3ddb); // fill the 10-cell tilemap strip

  // Paint the matching 10-cell colour column with colour 0. In the oracle this was a
  // tail jump whose ret carried loc_4816's caller; as a direct call it paints the colour
  // run and returns here, so loc_4816 returns to its own caller normally.
  return fillColourColumn(m);
}
