// SPDX-License-Identifier: GPL-3.0-only
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
import { stepEnemyActorStates } from "./stepEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * advanceObjectsAndRebuildSprites — the main-loop post-handler tail: run the four per-frame update passes in order.
 *
 * Steps the active target actor records, sweeps the per-object state dispatch, runs the
 * formation object-state dispatcher, then rebuilds the sprite display list. Pure sequencing.
 *
 * LIVE-OUT: memory only — whatever the four passes write. No register output.
 */

export function advanceObjectsAndRebuildSprites(m) {
  stepActiveTargetActorRecords(m);
  stepEnemyActorStates(m);
  dispatchFormationObjectStates(m);
  rebuildSpriteDisplayList(m);
}
