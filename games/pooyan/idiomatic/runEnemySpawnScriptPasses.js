// SPDX-License-Identifier: GPL-3.0-only
import { latchFreeSlotCountAndTamperCheck } from "./latchFreeSlotCountAndTamperCheck.js";
import { armEnemySpawnScript } from "./armEnemySpawnScript.js";
import { spawnNextScriptedEnemy } from "./spawnNextScriptedEnemy.js";
/**
 * runEnemySpawnScriptPasses — the per-frame enemy-spawn script pipeline.
 *
 * WHAT IT IS
 *   The small coordinator that drives Pooyan's scripted enemy-release machinery once per frame.
 *   Every board releases its lane enemies from a compact "spawn script": a chosen run of
 *   {stage-threshold, value} records plus a live cursor the wave logic plays out as the stage clock
 *   drains. Three sub-passes cooperate to install, arm, and pace that script, and this routine simply
 *   runs all three in their fixed order, then returns. Structurally it is a straight-line sequence of
 *   three subroutine calls — no branching and no state of its own.
 *
 * ROLE IN THE MACHINE
 *   This is the "enemy spawns" step of an active-play frame — the shared tail reached from the
 *   enemy-spawn frame step (ROM 0x511b), which is step 5 of the ten-step active-play worker chain.
 *   The three passes form a producer / gate / consumer chain over a handful of spawn-script RAM cells:
 *     1. armEnemySpawnScript (ROM 0x5150) — INSTALL. When the stage clock reaches one of this board's
 *        script thresholds and no program is yet in force, seed the live script cursor, its pacing
 *        timer, the alternate target-column source, and re-open the one-shot lane reset.
 *     2. latchFreeSlotCountAndTamperCheck (ROM 0x52f6) — ARM. While a program is in force but the
 *        release sweep is not yet armed this cycle, count the empty records in the enemy-actor pool
 *        and, if there is room, latch the go-signal that unlocks the sweep (folding a code-image
 *        checksum tripwire in as the price of arming).
 *     3. spawnNextScriptedEnemy (ROM 0x5334) — RELEASE. Once armed, tick the script's delay timer
 *        and, on expiry, advance the cursor and sweep the enemy-actor pool to activate one lane
 *        enemy; at the script terminator, tear the program back down.
 *   Running them in this order every frame lets one frame install a program, a later frame arm it,
 *   and the frames after that pace out the releases — the whole board's enemy cadence.
 *
 * ROM 0x5146. Grounding: [seen].
 *
 * LIVE-OUT: none — the sub-passes communicate only through the spawn-script RAM cells (the advance
 *   guard 0x8d6d, the sweep latch 0x8d6e, the live cursor 0x8d71, the delay timer 0x8d73, and the
 *   six-slot enemy-actor pool at 0x8ae0); this routine leaves nothing in any register its caller
 *   reads.
 */
export function runEnemySpawnScriptPasses(m) {
  // Pass 1 — INSTALL the spawn program. armEnemySpawnScript (ROM 0x5150) stays inert while a program
  // is already in force (the advance guard SCRIPT_ADVANCE_GUARD 0x8d6d is nonzero). With the guard
  // clear and the stage clock STAGE_COUNTDOWN (0x8901) sitting on one of this board's script
  // thresholds, it seeds the live cursor SCRIPT_DATA_PTR (0x8d71) and pacing timer SCRIPT_DELAY_TIMER
  // (0x8d73) from the selected program blob, points the alternate target/animation source
  // ALT_TARGET_TABLE_PTR (0x8d6f) at the matching row, resets the per-spawn tally, and latches the
  // guard so a program is armed exactly once per threshold as the stage drains.
  armEnemySpawnScript(m); // script-advance
  // Pass 2 — ARM the release sweep. latchFreeSlotCountAndTamperCheck (ROM 0x52f6) runs only while a
  // program is in force (guard 0x8d6d set) and the sweep is not yet armed this cycle (the latch
  // SLOT_SWEEP_LATCH 0x8d6e still clear). It counts the empty records in the six-slot enemy-actor
  // pool at ENEMY_ACTOR_TABLE (0x8ae0) and, if at least four are free, writes that count into the
  // latch — the nonzero go-signal that unlocks pass 3 and simultaneously locks this pass out until
  // the latch is cleared. Arming also folds a fixed stretch of the program image into a checksum and
  // bumps a tamper-strike counter (0x89e8) if that image has been altered.
  latchFreeSlotCountAndTamperCheck(m); // gated slot sweep
  // Pass 3 — RELEASE one scripted enemy. spawnNextScriptedEnemy (ROM 0x5334) does nothing until the
  // sweep latch (0x8d6e) is set. It reads the live script byte at SCRIPT_DATA_PTR (0x8d71): an
  // ordinary byte is a delay count, so it ticks SCRIPT_DELAY_TIMER (0x8d73) and, on expiry, reseeds
  // the timer from that byte, advances the cursor, and sweeps the enemy-actor pool at 0x8ae0 to
  // activate a single lane enemy. The script terminator (0xff) instead tears the program down —
  // clearing the guard, the latch, and the spawn timer — once the stage clock has drained past the
  // armed threshold.
  spawnNextScriptedEnemy(m); // countdown/expiry
}
