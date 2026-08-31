// SPDX-License-Identifier: GPL-3.0-only
import { initFormationRecordAndDeriveSpawnSpeed } from "./initFormationRecordAndDeriveSpawnSpeed.js";
import { tickSpawnTimerAndSeedFreeEnemy } from "./tickSpawnTimerAndSeedFreeEnemy.js";
import { tickEnemySpawnTimerAndGateSpawn } from "./tickEnemySpawnTimerAndGateSpawn.js";
import { spawnFormationEnemyOnInterval } from "./spawnFormationEnemyOnInterval.js";
import { spawnShotTargetOnInterval } from "./spawnShotTargetOnInterval.js";
import { spawnFormationEnemiesOnTimer } from "./spawnFormationEnemiesOnTimer.js";
import { runEnemySpawnScriptPasses } from "./runEnemySpawnScriptPasses.js";
import { ROUND_COUNTER, HUNTER_SPAWN_FLIP_FLAG, SCRIPT_ADVANCE_GUARD } from "./names.js";
/**
 * serviceEnemySpawns — per-frame enemy-update dispatcher, called from the idx-4 coordinator.
 * On an odd round it runs the three spawn schedulers, then tails
 * the spawn-cadence tick when the hunter-flip flag is set, else joins the shared tail; on an even
 * round it runs the formation spawn/init and joins the shared tail. The shared tail runs the
 * boot-frontier trampoline, returning early unless the script-advance guard is
 * clear, else running the enemy-spawn tick. LIVE-OUT: none — a void per-frame updater.
 */

export function serviceEnemySpawns(m) {
  const { mem8 } = m;

  if (mem8[ROUND_COUNTER] & 0x01) {
    spawnFormationEnemyOnInterval(m); // spawn scheduler A
    spawnShotTargetOnInterval(m); // spawn scheduler B
    spawnFormationEnemiesOnTimer(m); // frame-timer gated spawner
    if (mem8[HUNTER_SPAWN_FLIP_FLAG] !== 0) {
      tickSpawnTimerAndSeedFreeEnemy(m); // spawn-cadence tick
      return;
    }
  } else {
    initFormationRecordAndDeriveSpawnSpeed(m, mem8[ROUND_COUNTER]); // formation spawn/init
  }

  runEnemySpawnScriptPasses(m); // shared tail: boot-frontier trampoline
  if (mem8[SCRIPT_ADVANCE_GUARD] !== 0) return;
  tickEnemySpawnTimerAndGateSpawn(m); // enemy-spawn tick
}
