// SPDX-License-Identifier: GPL-3.0-only
/** driftOneTileSceneryAtThreeQuarters — carry one single-tile object through a frame: drift the slot the caller's cursors
 * name, then step both cursors onto the next slot so a caller can run straight into the object
 * after it.
 *
 * ROM 0x2D62-0x2D67: one call and a tail jump into advanceToNextSlot (0x309B).
 * Grounding: [seen] (names.js ROUTINES 0x2D62).
 *
 * ROLE IN THE MACHINE. The one-tile, three-quarter-pace member of the scenery parallax family
 * that runSceneryForEra dispatches over the eight scenery slots. At three quarters of the world's
 * pace the object falls behind the world and reads as a layer behind the playfield, nearer than
 * the half-pace one (mechanisms.md, scenery). It appears only in the 2001 (era 4) running order,
 * twice, which is how that order totals eight slots: 2+2+1+1+1+1 (names.js). It uses one slot.
 *
 * PARAMETERS: record = the object's 16-byte record (the ROM's IX), entry = its two-byte sprite
 * entry (IY) -- the paired cursors every slot sweep carries.
 * LIVE-OUT: memory, plus the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtThreeQuartersWorldScroll } from "./driftAtThreeQuartersWorldScroll.js";

export function driftOneTileSceneryAtThreeQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift reads the starting slot; seed it, then advance both cursors from that same slot.
  // 1. Move the object by three quarters of the world scroll on both axes (call 0x2D93).
  driftAtThreeQuartersWorldScroll(m, record, entry);
  // 2. No further tile: step straight on to the next slot (tail jump 0x309B).
  advanceToNextSlot(m, record, entry);
}
