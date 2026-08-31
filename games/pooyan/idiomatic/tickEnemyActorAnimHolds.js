// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickActorAnimHold } from "./tickActorAnimHold.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * tickEnemyActorAnimHolds — tick the animation-hold countdown for each record in the enemy actor table.
 * Walks the six fixed-stride records and steps every record's hold in place. Memory-only.
 */

const RECORD_COUNT = 6;
const RECORD_STRIDE = 0x18;

export function tickEnemyActorAnimHolds(m) {
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    tickActorAnimHold(m, rec);
    rec = u16(rec + RECORD_STRIDE);
  }
}
