// SPDX-License-Identifier: GPL-3.0-only
import { spawnPairedEnemyOnDelaySweep } from "./spawnPairedEnemyOnDelaySweep.js";
import { stepPairedDescendingObjects } from "./stepPairedDescendingObjects.js";
import { spawnEnemyOnBlinkCountdownSweep } from "./spawnEnemyOnBlinkCountdownSweep.js";
import { runObjectsElseVerifyTilemapChecksum } from "./runObjectsElseVerifyTilemapChecksum.js";
/**
 * runPerFrameObjectSubPasses — per-frame group update.
 *
 * Runs the four object sub-passes in order, once per frame: the delay-gated enemy-spawn
 * sweep, the paired descending-object stepper, the enemy-spawn sweep driver, and the
 * per-frame object driver with its one-shot tilemap check.
 *
 * LIVE-OUT: none — a void sequencer; each sub-pass acts on memory and the caller reads
 * nothing back.
 */
export function runPerFrameObjectSubPasses(m) {
  spawnPairedEnemyOnDelaySweep(m);
  stepPairedDescendingObjects(m);
  spawnEnemyOnBlinkCountdownSweep(m);
  runObjectsElseVerifyTilemapChecksum(m);
}
