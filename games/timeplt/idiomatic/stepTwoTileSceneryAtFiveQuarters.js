// SPDX-License-Identifier: GPL-3.0-only
/** stepTwoTileSceneryAtFiveQuarters — carry one two-tile object through a frame at five quarters
 * of the world scroll: drift the slot the cursors name, lay a second tile flush against it, and
 * step the cursors once more so they land past the pair rather than on its second half.
 * LIVE-OUT: memory, plus the two cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "./driftAtFiveQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";

export function stepTwoTileSceneryAtFiveQuarters(m, record = m.regs.ix, entry = m.regs.iy) {
  // The drift and the tile both read the starting slot; seed both. The placed tile advances the
  // cursors, so the closing step reads them onward.
  driftAtFiveQuartersWorldScroll(m, record, entry);
  placeAbuttingTile(m, entry, record);
  advanceToNextSlot(m);
}
