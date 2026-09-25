// SPDX-License-Identifier: GPL-3.0-only
/** driftTwoTileSceneryAtThreeQuarters — carry one two-tile object along with the world and step past both of its tiles: the
 * first is drifted at three quarters of the frame's world displacement, a second is placed flush
 * against it, and the cursors are stepped once more so a caller's next step lands beyond the
 * object rather than on its second half. LIVE-OUT: memory, plus the two cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtThreeQuartersWorldScroll } from "./driftAtThreeQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";

export function driftTwoTileSceneryAtThreeQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift and the tile both read the starting slot; seed both. The placed tile advances the
  // cursors, so the closing step reads them onward.
  driftAtThreeQuartersWorldScroll(m, record, entry);
  placeAbuttingTile(m, entry, record);
  advanceToNextSlot(m);
}
