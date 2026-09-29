// SPDX-License-Identifier: GPL-3.0-only
/** runSceneryForEra — run a frame of the scenery. The first slot is handed to the opening step as its
 * seed; from there each step advances both cursors and the next step inherits them, so nothing outside
 * chooses where the run starts. The era index then picks one of three fixed running orders: one for the
 * first era, one for the fifth, and one shared by everything between — including an index past the
 * fifth, which falls to that middle order rather than being refused. LIVE-OUT: memory, plus the two cursors. */

import { ERA_INDEX, SCENERY_ENTRY_SLOT0, SCENERY_RECORD_SLOT0 } from "./names.js";
import { driftThreeTileSceneryAtFiveQuarters } from "./driftThreeTileSceneryAtFiveQuarters.js";
import { stepTwoTileSceneryAtFiveQuarters } from "./stepTwoTileSceneryAtFiveQuarters.js";
import { driftTwoTileSceneryAtThreeQuarters } from "./driftTwoTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtThreeQuarters } from "./driftOneTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtHalf } from "./driftOneTileSceneryAtHalf.js";
import { driftNearestSceneryTriTile } from "./driftNearestSceneryTriTile.js";

const FIRST_ERA = 0;
const LAST_ERA = 4;

const OPENING_ORDER = [driftThreeTileSceneryAtFiveQuarters, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const MIDDLE_ORDER = [driftNearestSceneryTriTile, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const CLOSING_ORDER = [stepTwoTileSceneryAtFiveQuarters, stepTwoTileSceneryAtFiveQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf, driftOneTileSceneryAtHalf];

export function runSceneryForEra(m) {
  const { mem8 } = m;
  const era = mem8[ERA_INDEX];
  const order = era === FIRST_ERA ? OPENING_ORDER : era === LAST_ERA ? CLOSING_ORDER : MIDDLE_ORDER;

  // Seed the opening step with the first slot; each step then advances both cursors for the next.
  order[0](m, SCENERY_RECORD_SLOT0, SCENERY_ENTRY_SLOT0);
  for (let i = 1; i < order.length; i++) order[i](m);
}
