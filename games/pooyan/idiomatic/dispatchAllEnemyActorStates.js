// SPDX-License-Identifier: GPL-3.0-only
import { dispatchActiveEnemyActorState } from "./dispatchActiveEnemyActorState.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * dispatchAllEnemyActorStates — per-record state sweep. Walks the 14 enemy actor records in order, running the
 * per-record state dispatcher on each. The record pointer is marshalled into the still-frozen
 * dispatch handlers through IX (register bridge); the count is a plain local.
 *
 * LIVE-OUT: none — a void driver; every effect lands in the swept records.
 */
const RECORD_COUNT = 0x0e; // 14 records
const RECORD_STRIDE = 0x18; // 24 bytes per record

export function dispatchAllEnemyActorStates(m) {
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    m.regs.ix = rec; // record pointer the dispatched handlers read from IX (register bridge)
    m.push16(0x3384); // return slot the per-record dispatcher's ret consumes
    dispatchActiveEnemyActorState(m, rec);
    rec += RECORD_STRIDE;
  }
}
