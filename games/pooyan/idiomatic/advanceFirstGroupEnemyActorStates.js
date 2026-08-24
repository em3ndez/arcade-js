// SPDX-License-Identifier: GPL-3.0-only
import { advanceEnemyActorStateWalk } from "./advanceEnemyActorStateWalk.js";

const ENTRY_COUNT = 0x08; // records this twin entry ticks

/**
 * advanceFirstGroupEnemyActorStates — twin entry to the shared animation-tick walk.
 *
 * Seeds the record count (8) and runs the shared walk over the enemy-actor array.
 *
 * LIVE-OUT: none — a void delegator; the walk acts on memory and the caller reads nothing back.
 */
export function advanceFirstGroupEnemyActorStates(m) {
  advanceEnemyActorStateWalk(m, ENTRY_COUNT);
}
