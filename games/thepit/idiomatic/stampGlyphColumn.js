// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampGlyphColumn — stamp the fixed five-tile glyph down the object's map column,
 * paint its colour column, re-arm the object's state timer, then hand off to the
 * background-animation update.  ROM 0x2d6b.
 *
 * Reached when the dig/target object's countdown reaches its reload sentinel (from the
 * per-tick handler captureTargetOnOverlap). Working from the object's current display-cell pointer it:
 *   - stamps five fixed tile codes straight down one map column — one cell every 32
 *     addresses (the map is 32 cells wide) — in the column just before the object's,
 *     spanning two rows above the object cell to two below: 62, 20, 23, 24, 35 top→bottom;
 *   - paints those same five cells one colour (6) in the colour map, which sits 0x800
 *     below the tilemap;
 *   - clears the object's per-event latch and re-arms its state timer to 180 frames;
 *   - continues into the shared per-frame background-animation update as a tail hand-off:
 *     that routine's return is this routine's return.
 *
 * The background-animation update (0x2f71) is the decompiled advanceChamberCreature,
 * called directly — and it takes none of its inputs from a register, so the hand-off has
 * nothing to marshal.
 *
 * The name captures the visible effect (a fixed glyph appears at the object cell); what
 * that glyph depicts, and why it lands on the countdown's reload sentinel, is not yet
 * pinned, but the stamp itself is unambiguous.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d6b.test.js.
 * GATE:     real captured entry — 0x2d6b is dispatched once in the attract demo and its
 *           caller captureTargetOnOverlap ~119 times — checked RAM-only, plus a crafted sweep of the
 *           display-cell pointer across several map positions, identical both sides.
 *           Teeth: wrong-tile, wrong-colour, wrong-timer and un-cleared-latch twins are
 *           caught by the RAM diff.
 * LIVE-OUT: memory-only — the five stamped tile cells, the five painted colour cells,
 *           the cleared latch (0x8078) and the re-armed state timer (0x807c); then the
 *           decompiled background update runs identically on both sides (it reads no
 *           register left here). Leftover registers/flags are dead.
 * NAMES:    PLAYER_CELL_PTR (0x806e), TRANSITION_TIMER (0x807c) from names.js. The per-event latch
 *           0x8078 is the byte names.js names TREASURE_COLLECTED; it is kept as a hex literal
 *           here because on this dig-glyph subsystem it reads as a per-event latch clear,
 *           distinct from the loot collect->completion flow that shares the byte.
 */

import { PLAYER_CELL_PTR, TRANSITION_TIMER } from "./names.js";
import { advanceChamberCreature } from "./advanceChamberCreature.js";

// The glyph's fixed tile codes, top cell to bottom cell.
const GLYPH_TILES = [62, 20, 23, 24, 35];
// Cells one map row apart are 32 addresses apart (the map is 32 cells wide).
const ROW_STRIDE = 32;
// The colour map lies this far below the tilemap, so a tile's colour cell is its own
// address minus this distance.
const COLOUR_MAP_DISTANCE = 0x800;

export function stampGlyphColumn(m) {
  const { mem8, mem16 } = m;

  // The object's current display cell. The glyph is a vertical five-cell strip in the
  // map column just before it, so its top cell is two rows up and one cell back.
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

  // Clear the object's per-event latch (0x8078, the byte names.js names TREASURE_COLLECTED) and
  // re-arm its state timer. This clear is on the DIG-object glyph-stamp path (captureTargetOnOverlap -> here),
  // a SEPARATE subsystem from the player collect -> climb -> top-rung completion flow. The
  // observed natural level completion proves the completion gate SURVIVES this clear — the byte
  // is shared, but this is not a completion threat. Kept as a hex literal: on this dig path it
  // reads as a per-event latch, not the loot flag.
  mem8[0x8078] = 0;
  mem8[TRANSITION_TIMER] = 180;

  // Hand off to the background-animation update; its return unwinds to our
  // caller, so this is the exit.
  return advanceChamberCreature(m);
}
