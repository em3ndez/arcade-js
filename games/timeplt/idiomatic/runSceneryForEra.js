// SPDX-License-Identifier: GPL-3.0-only
/** runSceneryForEra — run a frame of the scenery. Both cursors are seated on the first slot
 * here, so every step below inherits them and nothing outside chooses where the run starts. The era index
 * then picks one of three fixed running orders: one for the first era, one for the fifth, and one
 * shared by everything between — including an index past the fifth, which falls to that middle
 * order rather than being refused. LIVE-OUT: memory, plus the two cursors. */

import { ERA_INDEX } from "./names.js";
import { driftThreeTileSceneryAtFiveQuarters } from "./driftThreeTileSceneryAtFiveQuarters.js";
import { stepTwoTileSceneryAtFiveQuarters } from "./stepTwoTileSceneryAtFiveQuarters.js";
import { driftTwoTileSceneryAtThreeQuarters } from "./driftTwoTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtThreeQuarters } from "./driftOneTileSceneryAtThreeQuarters.js";
import { driftOneTileSceneryAtHalf } from "./driftOneTileSceneryAtHalf.js";

const FIRST_RECORD = 0xa900;
const FIRST_ENTRY = 0xaa30;

const FIRST_ERA = 0;
const LAST_ERA = 4;

const DIAGONAL_PAIR = 0x2d21;
const AFTER_DIAGONAL_PAIR = 0x2cd1;

/** The one step still reached by transfer. It leaves through a return, so the slot that return
 *  consumes is laid down for it first. */
function diagonalPair(m) {
  m.push16(AFTER_DIAGONAL_PAIR);
  m.call(DIAGONAL_PAIR);
}

const OPENING_ORDER = [driftThreeTileSceneryAtFiveQuarters, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const MIDDLE_ORDER = [diagonalPair, driftTwoTileSceneryAtThreeQuarters, driftTwoTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf];
const CLOSING_ORDER = [stepTwoTileSceneryAtFiveQuarters, stepTwoTileSceneryAtFiveQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtThreeQuarters, driftOneTileSceneryAtHalf, driftOneTileSceneryAtHalf];

export function runSceneryForEra(m) {
  const { regs, mem8 } = m;
  regs.ix = FIRST_RECORD;
  regs.iy = FIRST_ENTRY;

  const era = mem8[ERA_INDEX];
  const order = era === FIRST_ERA ? OPENING_ORDER : era === LAST_ERA ? CLOSING_ORDER : MIDDLE_ORDER;
  for (const step of order) step(m);
}
