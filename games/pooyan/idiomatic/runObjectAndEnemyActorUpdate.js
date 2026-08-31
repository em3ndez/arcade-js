// SPDX-License-Identifier: GPL-3.0-only
import { advanceFirstGroupEnemyActorStates } from "./advanceFirstGroupEnemyActorStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { dispatchAllObjectStates } from "./dispatchAllObjectStates.js";
/**
 * runObjectAndEnemyActorUpdate — a per-frame driver that runs three subsystems in order.
 *
 * Advances the six-record object state table, walks the enemy-actor animation tick, then rebuilds
 * the sprite display list. Straight-line calls, no branches.
 *
 * SEATING: a void sequencer — no register survives; the caller reads only memory back.
 */
export function runObjectAndEnemyActorUpdate(m) {
  dispatchAllObjectStates(m); // advance the object state table (record-walk dispatcher)
  advanceFirstGroupEnemyActorStates(m);
  rebuildSpriteDisplayList(m);
}
