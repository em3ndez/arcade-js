// SPDX-License-Identifier: GPL-3.0-only
/** driftOneTileSceneryAtHalf — drift one object at half the shared displacement, then step the caller's pair of cursors on to the next
 * slot. Choosing that fraction and stepping exactly one slot is the whole of this entry; it reads no cell of its own
 * and decides nothing else.
 *
 * ROM 0x2D68-0x2D6D: one call and a tail jump into advanceToNextSlot (0x309B).
 * Grounding: [seen] (names.js ROUTINES 0x2D68).
 *
 * ROLE IN THE MACHINE. The one-tile member of the scenery parallax family that runSceneryForEra
 * dispatches over the eight scenery slots, and the slowest rung: moving at half the world's pace
 * it falls furthest behind, so what it moves reads as the farthest layer (mechanisms.md,
 * scenery). The "shared displacement" is the frame's world scroll -- the player's velocity
 * negated -- which every moving thing picks up. It closes the era-0 and eras-1-3 running orders
 * and closes era 4's twice over. It uses one slot.
 *
 * PARAMETERS: record = the object's 16-byte record (the ROM's IX), entry = its two-byte sprite
 * entry (IY) -- the paired cursors every slot sweep carries.
 * LIVE-OUT: memory, plus the two stepped cursors. */

import { driftAtHalfWorldScroll } from "./driftAtHalfWorldScroll.js";
import { advanceToNextSlot } from "./advanceToNextSlot.js";

export function driftOneTileSceneryAtHalf(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift reads the starting slot; seed it, then advance both cursors from that same slot.
  // 1. Move the object by half the world scroll on both axes (call 0x2DF4).
  driftAtHalfWorldScroll(m, record, entry);
  // 2. No further tile: step straight on to the next slot (tail jump 0x309B).
  advanceToNextSlot(m, record, entry);
}
