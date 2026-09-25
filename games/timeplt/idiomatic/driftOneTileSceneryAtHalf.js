// SPDX-License-Identifier: GPL-3.0-only
/** driftOneTileSceneryAtHalf — drift one object at half the shared displacement, then step the caller's pair of cursors on to the next
 * slot. Choosing that fraction and stepping exactly one slot is the whole of this entry; it reads no cell of its own
 * and decides nothing else. LIVE-OUT: memory, plus the two stepped cursors. */

import { driftAtHalfWorldScroll } from "./driftAtHalfWorldScroll.js";
import { advanceToNextSlot } from "./advanceToNextSlot.js";

export function driftOneTileSceneryAtHalf(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift reads the starting slot; seed it, then advance both cursors from that same slot.
  driftAtHalfWorldScroll(m, record, entry);
  advanceToNextSlot(m, record, entry);
}
