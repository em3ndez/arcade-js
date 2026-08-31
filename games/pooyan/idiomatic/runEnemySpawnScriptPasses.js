// SPDX-License-Identifier: GPL-3.0-only
import { latchFreeSlotCountAndTamperCheck } from "./latchFreeSlotCountAndTamperCheck.js";
import { armEnemySpawnScript } from "./armEnemySpawnScript.js";
import { spawnNextScriptedEnemy } from "./spawnNextScriptedEnemy.js";
/**
 * runEnemySpawnScriptPasses — per-frame enemy-spawn script pipeline: run the sub-passes in order each frame.
 * LIVE-OUT: none — the callees leave no register this routine or its caller reads.
 */
export function runEnemySpawnScriptPasses(m) {
  armEnemySpawnScript(m); // script-advance
  latchFreeSlotCountAndTamperCheck(m); // gated slot sweep
  spawnNextScriptedEnemy(m); // countdown/expiry
}
