// SPDX-License-Identifier: GPL-3.0-only
import { spawnNextEnemyOnDelay } from "./spawnNextEnemyOnDelay.js";
import { advanceAllEnemyActorStates } from "./advanceAllEnemyActorStates.js";
import { blitStackedTwoTileAnimFrameOnHoldTimer } from "./blitStackedTwoTileAnimFrameOnHoldTimer.js";
import { blinkTilePairOnCountdown } from "./blinkTilePairOnCountdown.js";
import { loc_02ef } from "./loc_02ef.js";

/**
 * updateGameplayFrame — dispatch state 2: the per-frame gameplay driver.
 *
 * Runs, in order, the enemy spawner, the arrow/object mover, the enemy two-tile blitter, the
 * blink-timer tile swap, and the per-frame sprite display-list rebuild, then returns. The spawner's
 * own caller-skip is handled internally, so it returns normally here. LIVE-OUT: none — a void driver.
 */

export function updateGameplayFrame(m) {
  spawnNextEnemyOnDelay(m); // enemy spawner
  advanceAllEnemyActorStates(m); // arrow / object mover
  blitStackedTwoTileAnimFrameOnHoldTimer(m); // enemy two-tile blitter
  blinkTilePairOnCountdown(m); // blink-timer tile swap
  loc_02ef(m); // rebuild the sprite display list
}
