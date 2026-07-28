// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintPlayfieldStripCol1Row11 — paint one fixed vertical tile strip of the round's static playfield,
 * then its matching colour column.  ROM 0x4816.
 *
 * Round setup (holdRoundIntroLoop / setUpRoundAndHoldIntro) draws the static playfield by calling a run of
 * these strip painters. This one positions a tile-cell cursor at column 1, row 11,
 * resolves that cell's tilemap and colour addresses, then lays a 10-cell vertical
 * run down the column:
 *
 *   - The strip's top cell takes a fixed cap byte and the nine cells below it are
 *     walked backwards through a ROM tile table at 0x494f (the tilemap fill).
 *   - The colour column then paints the same 10 cells with a single colour value (0).
 *
 * The cursor placement, address resolve, tilemap fill and colour-column fill are all
 * decompiled siblings, called directly: rowColToTileOffset stages the tilemap offset,
 * deriveTileWriteCursors turns it into the colour-RAM / video-RAM write cursors,
 * copyCappedTileColumn paints the tilemap strip (handed its ROM source-table pointer as
 * an ordinary JS argument), and fillColourColumn paints the colour run. Every cursor,
 * count and fill byte is written straight to memory.
 *
 * NAME kept paintPlayfieldStripCol1Row11: the mechanism (paint a fixed tile strip + colour column) is
 * clear, but this is one of a ~9-routine family (loc_472c..loc_48e5) that each paint a
 * different fixed strip, and which playfield element this particular one is has not
 * been earned — an English name would over-claim one strip's identity.
 *
 * Memory-equivalent to the frozen oracle on the observable RAM — equivalence-4816.test.js.
 * GATE:     crafted-entry. paintPlayfieldStripCol1Row11 is round-setup, NOT reached in attract, so it is
 *           validated on real machine states captured at a shared callee's dispatch
 *           (loc_3dae) during a boot/attract run. Because the decompiled helpers are
 *           plain calls with no machine stack frame, this routine no longer reproduces
 *           their return-address pushes and no longer runs the oracle's tail ret, so the
 *           gate diffs the observable RAM the routine paints + pc + SP (after modelling
 *           the return with one ret), excluding the dead stack-scratch window and the
 *           declared-dead value registers. Teeth = a wrong strip height.
 * LIVE-OUT: memory-only — the painted tilemap strip + colour column and the paint
 *           scratch (cursor 0x8058/0x8059, offset/address words TILEMAP_OFFSET/COLOUR_RAM_CURSOR/0x8060,
 *           count 0x8055, fill byte 0x8057). The caller reloads its own register from
 *           RAM and consumes nothing this leaves.
 * NAMES:    TILE_COL (0x8058), TILE_ROW (0x8059) from ram.js. Kept hex: 0x8057 is the
 *           colour fill byte here — ram.js reads this scratch as BOARD_MODE for a
 *           different routine family, so naming it that here would mislead; 0x8055 is
 *           the strip cell count (unnamed); 0x494f is a ROM tile-table address.
 *
 * PURPOSE [guess]: which playfield element; family caveat: loc_47e1 & loc_48e5 both = col1/row12, so coordinate naming has a latent collision — the whole loc_472c..loc_48e5 family should move to source/element-based names when decompiled. If the lead prefers not to lock in a coordinate name, hold at loc_4816 instead (mechanism is clear; only the element identity is un-earned).
 */

import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { fillColourColumn } from "./fillColourColumn.js";
import { copyCappedTileColumn } from "./copyCappedTileColumn.js";

// ROM tile table the tilemap fill walks (backwards) for every cell below the cap.
const STRIP_SOURCE_TABLE = 0x494f;
// Paint scratch shared with the fill helpers: the colour value painted down the
// column, and the number of cells in the vertical run.
const COLOUR_FILL = 0x8057;

export function paintPlayfieldStripCol1Row11(m) {
  const { mem8 } = m;

  // Position the tile-cell cursor at column 1, row 11, then resolve that cell's
  // tilemap offset (TILEMAP_OFFSET) and from it the colour-RAM and video-RAM write cursors
  // (COLOUR_RAM_CURSOR / 0x8060).
  mem8[TILE_COL] = 1;
  mem8[TILE_ROW] = 11;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);

  // Colour value 0, a 10-cell run, then paint the tilemap strip (top cell = the fixed
  // cap, the nine below walked back through the ROM table). The tilemap fill is now
  // decompiled (copyCappedTileColumn), called directly with its ROM source-table pointer.
  mem8[COLOUR_FILL] = 0;
  mem8[PLOT_RUN_LENGTH] = 10;
  copyCappedTileColumn(m, STRIP_SOURCE_TABLE); // fill the 10-cell tilemap strip

  // Paint the matching 10-cell colour column with colour 0. In the oracle this was a
  // tail jump whose ret carried paintPlayfieldStripCol1Row11's caller; as a direct call it paints the colour
  // run and returns here, so paintPlayfieldStripCol1Row11 returns to its own caller normally.
  return fillColourColumn(m);
}
