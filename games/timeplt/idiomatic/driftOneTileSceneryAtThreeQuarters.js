// SPDX-License-Identifier: GPL-3.0-only
/** driftOneTileSceneryAtThreeQuarters — carry one single-tile object through a frame: drift the slot the caller's cursors
 * name, then step both cursors onto the next slot so a caller can run straight into the object
 * after it. LIVE-OUT: memory, plus the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtThreeQuartersWorldScroll } from "./driftAtThreeQuartersWorldScroll.js";

export function driftOneTileSceneryAtThreeQuarters(m) {
  driftAtThreeQuartersWorldScroll(m);
  advanceToNextSlot(m);
}
