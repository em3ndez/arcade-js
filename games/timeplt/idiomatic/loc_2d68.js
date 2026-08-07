// SPDX-License-Identifier: GPL-3.0-only
/** loc_2d68 — drift one object at half the shared displacement, then step the caller's pair of cursors on to the next
 * slot. Choosing that fraction and stepping exactly one slot is the whole of this entry; it reads no cell of its own
 * and decides nothing else. LIVE-OUT: memory, plus the two stepped cursors. */

import { driftAtHalfWorldScroll } from "./driftAtHalfWorldScroll.js";
import { advanceToNextSlot } from "./advanceToNextSlot.js";

export function loc_2d68(m) {
  driftAtHalfWorldScroll(m);
  advanceToNextSlot(m);
}
