// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampGlyphColumn — stamp the fixed five-tile glyph down the object's map column, paint its colour
 * column, re-arm the object's state timer, then hand off to the background-animation update.
 *
 * Reached when the dig/target object's countdown reaches its reload sentinel. From the object's
 * current display-cell pointer it stamps five fixed tile codes straight down the map column just
 * before the object's (one cell every 32 addresses, spanning two rows above the object cell to two
 * below), paints those same five cells one colour in the colour map (which sits below the tilemap),
 * clears the object's per-event latch, re-arms its state timer to 180 frames, and continues into the
 * shared background-animation update as a tail hand-off whose return is this routine's return.
 */

import { PLAYER_CELL_PTR, TRANSITION_TIMER, TREASURE_COLLECTED } from "./names.js";
import { advanceChamberCreature } from "./advanceChamberCreature.js";

// The glyph's fixed tile codes, top cell to bottom cell.
const GLYPH_TILES = [62, 20, 23, 24, 35];
const ROW_STRIDE = 32;
// The colour map lies this far below the tilemap (a tile's colour cell is its address minus this).
const COLOUR_MAP_DISTANCE = 0x800;

export function stampGlyphColumn(m) {
  const { mem8, mem16 } = m;

  // The object's current display cell; the glyph's top cell is two rows up and one cell back.
  const objectCell = mem16[PLAYER_CELL_PTR];
  const topCell = objectCell - 2 * ROW_STRIDE - 1;

  // Stamp the fixed glyph straight down the column.
  let tileCell = topCell;
  for (const tile of GLYPH_TILES) {
    mem8[tileCell] = tile;
    tileCell += ROW_STRIDE;
  }

  // Paint the matching colour column below the tilemap.
  let colourCell = topCell - COLOUR_MAP_DISTANCE;
  for (let i = 0; i < GLYPH_TILES.length; i++) {
    mem8[colourCell] = 6;
    colourCell += ROW_STRIDE;
  }

  // Clear the object's per-event latch and re-arm its state timer. On this dig-glyph path the byte
  // reads as a per-event latch, distinct from the loot-collect completion flow that shares it.
  mem8[TREASURE_COLLECTED] = 0;
  mem8[TRANSITION_TIMER] = 180;

  // Tail hand-off to the background-animation update; its return is this routine's exit.
  return advanceChamberCreature(m);
}
