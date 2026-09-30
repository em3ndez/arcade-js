// SPDX-License-Identifier: GPL-3.0-only
/** driftThreeTileSceneryAtFiveQuarters — carry one three-tile object through a frame: drift the slot it starts on, lay the
 * two further tiles that abut it, and leave both cursors on the slot after the last of them, so a
 * caller can run straight into the next object.
 *
 * ROM 0x2D15-0x2D20: three calls and a tail jump into advanceToNextSlot (0x309B).
 * Grounding: [seen] (names.js ROUTINES 0x2D15).
 *
 * ROLE IN THE MACHINE. The near object of the 1910 (era 0) scenery order that runSceneryForEra
 * dispatches over the eight scenery slots: at five-quarter pace it over-travels the world and so
 * reads as in front of the playfield (mechanisms.md, scenery). Its three tiles lie in a straight
 * strip -- each further tile placed one sprite width on from the one before -- which is what
 * separates it from driftNearestSceneryTriTile, the cornered shape of eras 1-3. Only the head tile
 * drifts; the others are rebuilt from it every frame, so the strip never comes apart. It uses
 * three slots, and the era-0 order comes to 3+2+2+1 = eight (names.js).
 *
 * PARAMETERS: record = the object's 16-byte record (the ROM's IX), entry = its two-byte sprite
 * entry (IY) -- the paired cursors every slot sweep carries.
 * LIVE-OUT: memory, plus the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "./driftAtFiveQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";

// Tiles placed after the head: two, in the ROM as two back-to-back `call 0x3058`.
const FURTHER_TILES = 2;

export function driftThreeTileSceneryAtFiveQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift and the first tile both read the starting slot; seed both. The placed tile then advances
  // the cursors, so the further tiles and the closing step read them onward.
  // 1. Head tile: move by the world scroll plus a quarter of it (call 0x2D6E).
  driftAtFiveQuartersWorldScroll(m, record, entry);
  // 2. Second tile, flush against the head (first `call 0x3058`).
  let [tileRecord, tileEntry] = placeAbuttingTile(m, entry, record);
  // 3. The remaining further tile(s), each flush against the one before (second `call 0x3058`).
  for (let tile = 1; tile < FURTHER_TILES; tile++) [tileRecord, tileEntry] = placeAbuttingTile(m, tileEntry, tileRecord);
  // 4. Step both cursors past the last tile onto the next object's slot (tail jump 0x309B), and hand
  //    them back for the next step in the running order.
  return advanceToNextSlot(m, tileRecord, tileEntry);
}
