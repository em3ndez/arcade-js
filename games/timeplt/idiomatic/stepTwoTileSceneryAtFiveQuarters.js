// SPDX-License-Identifier: GPL-3.0-only
/** stepTwoTileSceneryAtFiveQuarters — carry one two-tile object through a frame at five quarters
 * of the world scroll: drift the slot the cursors name, lay a second tile flush against it, and
 * step the cursors once more so they land past the pair rather than on its second half.
 * LIVE-OUT: memory, plus the two cursors.
 *
 * ROM 0x2D2D-0x2D35 (call 0x2D6E, call 0x3058, then jp 0x309B as a tail). Grounding: [seen].
 *
 * Role in the machine: one member of the scenery family reached from the era-keyed dispatcher
 * that walks the scenery slots each frame. Its siblings are the same three calls with one term
 * changed (the drift fraction, or the number of tiles). Moving at five quarters of the world
 * scroll makes the object over-travel the background.
 *
 * Parameters: `record` -- the object record cursor (IX in the ROM), holding the fractional
 * coordinates; `entry` -- the parallel sprite-entry cursor (IY), holding the whole coordinates.
 * The two cursors are stepped together by advanceToNextSlot, one slot at a time.
 *
 * LIVE-OUT: the two sprite entries and records touched, and the cursors left two slots on. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "./driftAtFiveQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";

export function stepTwoTileSceneryAtFiveQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // Step 1 (0x2D6E): move the object by the frame's world-scroll displacement plus a further
  // quarter of it, on both coordinates -- whole part into the sprite entry, fraction into the
  // record. The displacement is the negation of the player's own velocity: the camera.
  //
  // Step 2 (0x3058): place the object's second sprite tile flush against the first and step
  // both cursors onto it, so the pair moves as one.
  //
  // Step 3 (0x309B, the ROM's tail jump): step both cursors once more, past the pair, so the
  // dispatcher's next call starts on the next object rather than this one's second tile.
  //
  // The drift and the tile both read the starting slot; seed both. The placed tile advances the
  // cursors, so the closing step reads them onward.
  driftAtFiveQuartersWorldScroll(m, record, entry);
  placeAbuttingTile(m, entry, record);
  advanceToNextSlot(m);
}
