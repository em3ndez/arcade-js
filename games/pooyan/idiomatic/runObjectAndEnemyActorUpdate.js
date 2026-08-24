// SPDX-License-Identifier: GPL-3.0-only
import { advanceFirstGroupEnemyActorStates } from "./advanceFirstGroupEnemyActorStates.js";
import { loc_02ef } from "./loc_02ef.js";
import { loc_76f4 } from "./loc_76f4.js";
/**
 * runObjectAndEnemyActorUpdate — a per-frame driver that runs three subsystems in order.
 *
 * Advances the six-record object state table, walks the enemy-actor animation tick, then rebuilds
 * the sprite display list. Straight-line calls, no branches.
 *
 * SEATING: a void sequencer — no register survives; the caller reads only memory back.
 */
export function runObjectAndEnemyActorUpdate(m) {
  loc_76f4(m); // advance the object state table (record-walk dispatcher)
  advanceFirstGroupEnemyActorStates(m);
  loc_02ef(m);
}
