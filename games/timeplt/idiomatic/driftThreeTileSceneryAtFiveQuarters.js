// SPDX-License-Identifier: GPL-3.0-only
/** driftThreeTileSceneryAtFiveQuarters — carry one three-tile object through a frame: drift the slot it starts on, lay the
 * two further tiles that abut it, and leave both cursors on the slot after the last of them, so a
 * caller can run straight into the next object. LIVE-OUT: memory, plus the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";
import { driftAtFiveQuartersWorldScroll } from "./driftAtFiveQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";

const FURTHER_TILES = 2;

export function driftThreeTileSceneryAtFiveQuarters(m) {
  driftAtFiveQuartersWorldScroll(m);
  for (let tile = 0; tile < FURTHER_TILES; tile++) placeAbuttingTile(m);
  advanceToNextSlot(m);
}
