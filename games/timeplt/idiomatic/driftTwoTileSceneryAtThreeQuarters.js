// SPDX-License-Identifier: GPL-3.0-only
/** driftTwoTileSceneryAtThreeQuarters — carry one two-tile object along with the world and step past both of its tiles: the
 * first is drifted at three quarters of the frame's world displacement, a second is placed flush
 * against it, and the cursors are stepped once more so a caller's next step lands beyond the
 * object rather than on its second half.
 *
 * ROM 0x2D36-0x2D3E: two calls and a tail jump into advanceToNextSlot (0x309B).
 * Grounding: [seen] (names.js ROUTINES 0x2D36).
 *
 * ROLE IN THE MACHINE. The two-tile, three-quarter-pace member of the scenery parallax family
 * that runSceneryForEra dispatches over the eight scenery slots. At three quarters of the world's
 * pace the object falls behind the world and reads as a layer behind the playfield (mechanisms.md,
 * scenery). The era-0 and eras-1-3 running orders each call it twice in a row -- two consecutive
 * two-tile objects. Only the head tile drifts; the second is rebuilt from it every frame, so the
 * object never comes apart. It uses two slots.
 *
 * PARAMETERS: record = the object's 16-byte record (the ROM's IX), entry = its two-byte sprite
 * entry (IY) -- the paired cursors every slot sweep carries.
 * LIVE-OUT: memory, plus the two cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtThreeQuartersWorldScroll } from "./driftAtThreeQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";

export function driftTwoTileSceneryAtThreeQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift and the tile both read the starting slot; seed both. The placed tile advances the
  // cursors, so the closing step reads them onward.
  // 1. Head tile: move by three quarters of the world scroll (call 0x2D93).
  driftAtThreeQuartersWorldScroll(m, record, entry);
  // 2. Second tile, flush against the head, one sprite width on (call 0x3058).
  placeAbuttingTile(m, entry, record);
  // 3. Step both cursors past the second tile onto the next object's slot (tail jump 0x309B).
  advanceToNextSlot(m);
}
