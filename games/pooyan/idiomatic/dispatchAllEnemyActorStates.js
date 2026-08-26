// SPDX-License-Identifier: GPL-3.0-only
import { dispatchActiveEnemyActorState } from "./dispatchActiveEnemyActorState.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * dispatchAllEnemyActorStates — per-record state sweep. Walks the 14 enemy actor records in order, running the
 * per-record state dispatcher on each, passing it the record pointer; the count is a plain local.
 *
 * LIVE-OUT: none — a void driver; every effect lands in the swept records.
 */
const RECORD_COUNT = 0x0e; // 14 records
const RECORD_STRIDE = 0x18; // 24 bytes per record

export function dispatchAllEnemyActorStates(m) {
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    dispatchActiveEnemyActorState(m, rec);
    rec += RECORD_STRIDE;
  }
}
