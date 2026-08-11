// SPDX-License-Identifier: GPL-3.0-only
/** runSceneryForEra — run a frame of the scenery. Both cursors are seated on the first slot
 * here, so every step below inherits them and nothing outside chooses where the run starts. The era index
 * then picks one of three fixed running orders: one for the first era, one for the fifth, and one
 * shared by everything between — including an index past the fifth, which falls to that middle
 * order rather than being refused. LIVE-OUT: memory, plus the two cursors. */

import { ERA_INDEX, SCENERY_ENTRY_SLOT0, SCENERY_RECORD_SLOT0 } from "./names.js";
import { driftThreeTileSceneryAtFiveQuarters } from "./driftThreeTileSceneryAtFiveQuarters.js";
import { stepTwoTileSceneryAtFiveQuarters } from "./stepTwoTileSceneryAtFiveQuarters.js";
import { driftTwoTileSceneryAtThreeQuarters } from "./driftTwoTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtThreeQuarters } from "./driftOneTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtHalf } from "./driftOneTileSceneryAtHalf.js";
import { driftNearestSceneryTriTile } from "./driftNearestSceneryTriTile.js";


const FIRST_ERA = 0;
const LAST_ERA = 4;

const AFTER_DIAGONAL_PAIR = 0x2cd1;

/** The one step still reached by transfer. The parked slot is a real stack write the frozen step's
 *  tail return consumed; the lifted step drops that return, so it is laid down and popped here. */
function diagonalPair(m) {
  m.push16(AFTER_DIAGONAL_PAIR);
  driftNearestSceneryTriTile(m);
  m.ret();
}

const OPENING_ORDER = [driftThreeTileSceneryAtFiveQuarters, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const MIDDLE_ORDER = [diagonalPair, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const CLOSING_ORDER = [stepTwoTileSceneryAtFiveQuarters, stepTwoTileSceneryAtFiveQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf, driftOneTileSceneryAtHalf];

export function runSceneryForEra(m) {
  const { regs, mem8 } = m;
  regs.ix = SCENERY_RECORD_SLOT0;
  regs.iy = SCENERY_ENTRY_SLOT0;

  const era = mem8[ERA_INDEX];
  const order = era === FIRST_ERA ? OPENING_ORDER : era === LAST_ERA ? CLOSING_ORDER : MIDDLE_ORDER;
  for (const step of order) step(m);
}
