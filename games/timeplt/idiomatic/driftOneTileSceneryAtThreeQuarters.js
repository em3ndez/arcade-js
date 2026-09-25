// SPDX-License-Identifier: GPL-3.0-only
/** driftOneTileSceneryAtThreeQuarters — carry one single-tile object through a frame: drift the slot the caller's cursors
 * name, then step both cursors onto the next slot so a caller can run straight into the object
 * after it. LIVE-OUT: memory, plus the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtThreeQuartersWorldScroll } from "./driftAtThreeQuartersWorldScroll.js";

export function driftOneTileSceneryAtThreeQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift reads the starting slot; seed it, then advance both cursors from that same slot.
  driftAtThreeQuartersWorldScroll(m, record, entry);
  advanceToNextSlot(m, record, entry);
}
