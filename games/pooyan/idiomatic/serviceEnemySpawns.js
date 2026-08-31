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
 * serviceEnemySpawns -- the per-frame enemy-spawn dispatcher for active play.
 *
 * WHAT IT IS
 *   The single per-frame entry point that decides which enemy-spawning machinery
 *   runs this frame and then, unless it bailed early, drives the shared spawn-timer
 *   tick. It owns no actor state of its own; it is a router that fans out to the
 *   spawn schedulers, the formation-init, the per-frame spawn-script pipeline, and
 *   the spawn-timer tick, choosing among them by the round parity and two latches.
 *
 * ROLE IN THE MACHINE
 *   Invoked by the active-gameplay frame coordinator (main-state index 4) as the
 *   enemy-spawn stage of its fixed-order per-frame pipeline. During a live round
 *   this is the routine that keeps new hunters, formation members, and shot targets
 *   arriving on cadence; it runs every frame that the round is in active play.
 *
 * ROM address: 0x511b (0x511b-0x5145).
 * Grounding: [seen].
 *
 * LIVE-OUT: none -- a void per-frame updater. Its observable effect is entirely
 *   in what its callees mutate: the enemy / formation / target actor arrays, the
 *   spawn-cadence timer (ENEMY_SPAWN_TIMER 0x8d07), the enemy-count / arrival
 *   tallies, and the derived enemy spawn speed. Nothing is returned here.
 *
 * SHAPE
 *   The frame's work is split by the parity of the round counter (ROUND_COUNTER
 *   0x8907, bit0):
 *     - odd round  -> run the three spawn schedulers, then either take the
 *                     hunter-flip early exit or fall through to the shared tail;
 *     - even round -> run the one-shot formation spawn/init, then fall through to
 *                     the shared tail.
 *   The shared tail runs the per-frame spawn-script pipeline pass and then, unless
 *   a script step is still holding (SCRIPT_ADVANCE_GUARD 0x8d6d), the spawn-timer
 *   tick that seeds the next enemy when the cadence timer reaches zero.
 */

export function serviceEnemySpawns(m) {
  const { mem8 } = m;

  // Branch on the parity of the round counter (ROUND_COUNTER 0x8907). Bit0
  // alternates every round and is used throughout the spawn code to pick the
  // stage-type / facing variant; here it selects which spawning path runs this
  // frame. Odd round (bit0 set) -> the multi-scheduler path; even round -> the
  // one-shot formation-init path.
  if (mem8[ROUND_COUNTER] & 0x01) {
    // Odd-round spawn schedulers, run in fixed order every odd-round frame.

    // Spawn scheduler A: interval-gated formation-enemy spawn. Below round 4 a
    // difficulty gate can veto the tick (round < 2 needs difficulty >= 3, rounds
    // 2-3 need difficulty >= 2); from round 4 up it always proceeds.
    spawnFormationEnemyOnInterval(m);

    // Spawn scheduler B: interval-gated shot-target spawn; falls through into the
    // free-slot seed loop that initialises the newly scheduled record.
    spawnShotTargetOnInterval(m);

    // Frame-timer gated formation spawner: when its own countdown expires it runs
    // the formation spawn loop, otherwise it returns without spawning this frame.
    spawnFormationEnemiesOnTimer(m);

    // Hunter-spawn flip latch (HUNTER_SPAWN_FLIP_FLAG 0x8f61). When it is set the
    // launch state machine is diverting spawns into a sub-counter bump rather than
    // enqueuing the spawn display command, so on an odd round this routine takes an
    // early exit: it runs the spawn-cadence tick directly and skips the shared
    // tail (the spawn-script pipeline + guarded spawn-timer tick below).
    if (mem8[HUNTER_SPAWN_FLIP_FLAG] !== 0) {
      // Spawn-cadence tick: decrement the spawn timer, and when it hits zero sweep
      // the six enemy records (gated on stage-countdown vs active enemy count) and
      // initialise the first free slot, seeding one new enemy.
      tickSpawnTimerAndSeedFreeEnemy(m);
      return;
    }
    // Flip flag clear -> fall through to the shared tail below.
  } else {
    // Even round: the one-shot gated formation-record spawn/init. It fills the
    // formation record fields and derives the enemy spawn speed from the round
    // counter (passed in as the current ROUND_COUNTER value), then returns; this
    // path also falls through to the shared tail.
    initFormationRecordAndDeriveSpawnSpeed(m, mem8[ROUND_COUNTER]);
  }

  // Shared tail (reached by the even-round path, and by the odd-round path when the
  // hunter-flip early exit was not taken).

  // Per-frame enemy-spawn script pipeline: run its sub-passes in order for this
  // frame, advancing the enemy-spawn script.
  runEnemySpawnScriptPasses(m);

  // Script-advance guard (SCRIPT_ADVANCE_GUARD 0x8d6d): nonzero means a spawn-script
  // step is still holding / busy, so the spawn-timer tick is suppressed this frame
  // and the routine returns. Only when the guard is clear does the cadence tick run.
  if (mem8[SCRIPT_ADVANCE_GUARD] !== 0) return;

  // Enemy-spawn tick: while the spawn timer is nonzero, decrement it and return; at
  // zero, decide whether to spawn -- on an even round hand the decision to the spawn
  // gate, else gate on stage countdown vs active enemy count (bailing when they are
  // equal, when the countdown is below the count, or when the count has reached the
  // difficulty threshold) -- and on a pass sweep the six actor slots, seeding at
  // most one new enemy this tick.
  tickEnemySpawnTimerAndGateSpawn(m);
}
