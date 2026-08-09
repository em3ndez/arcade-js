// SPDX-License-Identifier: GPL-3.0-only
/** driftNearestSceneryTriTile — drift one scenery object with the world scroll, over-travelling it a quarter, then
 * place the tile abutting it and the one cornering it, and step both cursors past. LIVE-OUT: memory, cursors. */

import { driftAtFiveQuartersWorldScroll } from "./driftAtFiveQuartersWorldScroll.js";
import { placeAbuttingTile } from "./placeAbuttingTile.js";
import { placeDiagonallyAbuttingTile } from "./placeDiagonallyAbuttingTile.js";
import { advanceToNextSlot } from "./advanceToNextSlot.js";

export function driftNearestSceneryTriTile(m) {
  driftAtFiveQuartersWorldScroll(m);
  placeAbuttingTile(m);
  placeDiagonallyAbuttingTile(m);
  advanceToNextSlot(m);
}
