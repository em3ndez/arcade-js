// SPDX-License-Identifier: GPL-3.0-only
import { sweepActorRecordSlotsBothParitiesOnOddRound } from "./sweepActorRecordSlotsBothParitiesOnOddRound.js";
import { sweepBothActorRecordSlotsForHit } from "./sweepBothActorRecordSlotsForHit.js";
import { resolveObjectProximityHitsBothSlots } from "./resolveObjectProximityHitsBothSlots.js";
import { resolveProjectileCollisionsBothActorSlots } from "./resolveProjectileCollisionsBothActorSlots.js";
import { gateAndRunProjectileTargetSweep } from "./gateAndRunProjectileTargetSweep.js";
import { flagTamperOnRound5ChecksumMiss } from "./flagTamperOnRound5ChecksumMiss.js";
import { scanProximityTargetPairsAgainstSource } from "./scanProximityTargetPairsAgainstSource.js";
import { scanEnemyRecordsForCollision } from "./scanEnemyRecordsForCollision.js";
import { scanActorCollisionsBothSlots } from "./scanActorCollisionsBothSlots.js";
import { tickEnemyActorAnimHolds } from "./tickEnemyActorAnimHolds.js";
import { fireArmedEnemyProjectilesAndDisarm } from "./fireArmedEnemyProjectilesAndDisarm.js";
/**
 * runActorUpdatePipeline — master per-frame actor updater.
 *
 * Invokes the eleven per-frame subsystem handlers in a fixed order, then returns. A straight
 * sequencer: no branches and no register hand-off — each callee reads and writes work RAM and
 * returns void, and this driver consumes none of their results.
 *
 * LIVE-OUT: none — a void driver; the caller resumes on its own state.
 */
export function runActorUpdatePipeline(m) {
  sweepActorRecordSlotsBothParitiesOnOddRound(m); // odd-round actor sweep
  sweepBothActorRecordSlotsForHit(m);
  resolveObjectProximityHitsBothSlots(m);
  resolveProjectileCollisionsBothActorSlots(m);
  gateAndRunProjectileTargetSweep(m);
  flagTamperOnRound5ChecksumMiss(m); // round-5 checksum tamper tally
  scanProximityTargetPairsAgainstSource(m);
  scanEnemyRecordsForCollision(m);
  scanActorCollisionsBothSlots(m); // two-pass actor collision driver
  tickEnemyActorAnimHolds(m);
  fireArmedEnemyProjectilesAndDisarm(m); // end-of-wave object-table cleanup
}
