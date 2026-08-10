// SPDX-License-Identifier: GPL-3.0-only
/** dispatchShotSweepByMotherShipArmed — run this stretch of a round's shot sweep against the full run of seven targets.
 * MOTHER_SHIP_ARMED picks which of two sweeps runs: while set, the sweep that also covers the standing
 * object runs (staging its own runs); while clear, this stages the shared sweep's two cursor cells and
 * hands it the seven-target run (both counts seven). LIVE-OUT: memory only. */

import { destroyCraftAndMotherShipHitByShots } from "./destroyCraftAndMotherShipHitByShots.js";
import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0, MOTHER_SHIP_ARMED, PLAYER_SHOT_ARRAY } from "./names.js";

const SHOTS = 6;
const TARGETS = 7;
const REACH = 7;
const SPAN = 15;

const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;

export function dispatchShotSweepByMotherShipArmed(m) {
  const { mem8, mem16 } = m;
  if (mem8[MOTHER_SHIP_ARMED] !== 0) {
    destroyCraftAndMotherShipHitByShots(m);
    return;
  }

  mem16[TARGET_RECORD_CURSOR] = CRAFT_RECORD_SLOT0;
  mem16[TARGET_ENTRY_CURSOR] = CRAFT_ENTRY_SLOT0;
  destroyTargetsHitByShots(
    m, PLAYER_SHOT_ARRAY, CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0,
    TARGETS, TARGETS, SHOTS, REACH, SPAN,
  );
}
