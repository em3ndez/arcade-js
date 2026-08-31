// SPDX-License-Identifier: GPL-3.0-only
import { blitStackedTwoTileAnimFrameOnHoldTimer } from "./blitStackedTwoTileAnimFrameOnHoldTimer.js";
import { runActorGroupStateHandler } from "./runActorGroupStateHandler.js";
import { updateEnemyActorsAndCycleLaunchFlipAnim } from "./updateEnemyActorsAndCycleLaunchFlipAnim.js";
import { dispatchSpecialObjectRecordState } from "./dispatchSpecialObjectRecordState.js";
import { ENEMY_ACTOR_TABLE, HUNTER_TABLE_BASE } from "./names.js";
/**
 * runObjectAndSpawnUpdatePass — the fountain/spawn subtree driver, run on even frames.
 *
 * Seeds the two-tile fountain blitter, dispatches the fountain record's per-frame state handler,
 * runs the three-record enemy-actor state pass, then the enemy-record state dispatch. Straight-line
 * calls, no branches.
 *
 * SEATING: a void sequencer — no register survives; the caller reads only memory back.
 */
export function runObjectAndSpawnUpdatePass(m) {
  blitStackedTwoTileAnimFrameOnHoldTimer(m);
  runActorGroupStateHandler(m, HUNTER_TABLE_BASE); // fountain record for the state dispatch
  updateEnemyActorsAndCycleLaunchFlipAnim(m, ENEMY_ACTOR_TABLE);
  return dispatchSpecialObjectRecordState(m); // enemy-record state dispatcher
}
