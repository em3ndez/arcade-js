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
 * WHAT IT IS
 *   ROM 0x5ae4-0x5b05. The single per-frame entry point that drives every actor,
 *   collision and object-teardown pass the game runs while a wave is alive. It is
 *   a straight sequencer: it invokes eleven subsystem handlers in a fixed order,
 *   one after another, and then returns. There are no branches here and no data
 *   passed between the handlers — each one reads and rewrites its own work-RAM
 *   records and returns nothing, and this driver reads nothing back from any of
 *   them. The entire actor world for the frame is advanced by the side effects
 *   the eleven passes leave in memory.
 *
 * ROLE IN THE MACHINE
 *   Enemies, the player box, launched projectiles/grabs and the spawned-object
 *   bank all live as fixed-stride records in work RAM. Once per frame the main
 *   loop calls this pipeline to: sweep those records for movement/animation
 *   bookkeeping, run the bank of proximity/overlap tests that decide who has been
 *   hit, tally and tear down whatever collided, and finally sweep the wave for
 *   end-of-wave cleanup. The fixed order matters — the earlier sweeps settle the
 *   records and raise the per-slot hit flags that the later collision resolvers
 *   and the teardown pass act on. Any pass may tear down a struck object and
 *   abort its own scan for the frame, but each is self-contained, so aborting one
 *   never disturbs the ones that follow it here.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none — a void driver. It leaves no result for the caller; the caller
 * resumes on its own state. All lasting effects are the work-RAM writes made by
 * the eleven callees (moved actor records, raised hit flags, torn-down objects,
 * bumped tallies, and any queued sound/display effects).
 */
export function runActorUpdatePipeline(m) {
  // Pass 1 — odd-round actor sweep (ROM 0x5e78). On an odd round only, hand the
  // actor-record table to the per-slot sweep twice: phase latch 0 on the first
  // pass and 1 on the second, with the table pointer advanced one record between
  // passes. This settles the enemy records (movement/state) before the collision
  // resolvers below read them.
  sweepActorRecordSlotsBothParitiesOnOddRound(m); // odd-round actor sweep
  // Pass 2 — hit sweep over both actor-record slots (ROM 0x5f6a). Walks the two
  // actor-record slots through the per-slot handler, once per pass.
  sweepBothActorRecordSlotsForHit(m);
  // Pass 3 — object-proximity hits, both target slots (ROM 0x602f). Runs the
  // per-slot object-proximity scan once for each of the two target slots; a hit
  // inside a pass aborts before the remaining slot is scanned.
  resolveObjectProximityHitsBothSlots(m);
  // Pass 4 — projectile collisions over both actor boxes (ROM 0x6368). A two-pass
  // projectile-proximity scan over the two actor boxes (SPRITE_ACTOR_RECORD_SLOTS
  // +0 then +4), forwarding I=0 then I=4 as the parity selector that picks which
  // per-slot hit flag a collision raises; aborts on the first hit.
  resolveProjectileCollisionsBothActorSlots(m);
  // Pass 5 — grab/target sweep, gated (ROM 0x5df7). Bails if the grab latch is set
  // or the formation/teardown state is non-zero; otherwise seeds the source/target/
  // record pointers plus the slot count and runs the three-slot proximity sweep,
  // aborting the instant a grab connects.
  gateAndRunProjectileTargetSweep(m);
  // Pass 6 — round-5 checksum tamper tally (ROM 0x5b06). An anti-tamper tripwire
  // folded into the actor sweep rather than a collision step: only at round 5 it
  // sums six program bytes and, if the checksum does not balance, bumps the freeze
  // tally (TAMPER_FREEZE_FLAG) that downstream spawn code reads to stall.
  flagTamperOnRound5ChecksumMiss(m); // round-5 checksum tamper tally
  // Pass 7 — proximity target-pair scan against a source (ROM 0x5d4d). Tests a
  // fixed source object against three target/record pairs (SPRITE_TARGET_SLOTS
  // stride 4 / PROJECTILE_TABLE stride 0x18), aborting the scan on the first hit.
  scanProximityTargetPairsAgainstSource(m);
  // Pass 8 — enemy-record collision sweep (ROM 0x5b86). Sweeps the per-record
  // collision check across the six enemy-actor records.
  scanEnemyRecordsForCollision(m);
  // Pass 9 — two-pass actor collision driver (ROM 0x6404). Guarded by
  // PLAY_MODE_LATCH / ROUND_COUNTER bit 0, it scans the actor record twice
  // (selector 0 then 4), aborting on a collision — the terminator skip inside the
  // scan unwinds this frame.
  scanActorCollisionsBothSlots(m); // two-pass actor collision driver
  // Pass 10 — tick enemy animation holds (ROM 0x5d0b). Ticks the animation-hold
  // countdown for each of the six enemy actor-table records.
  tickEnemyActorAnimHolds(m);
  // Pass 11 — end-of-wave object-table cleanup (ROM 0x5b2c). Stays inert while the
  // launch-arm latch is clear or the active-lane count is still non-zero; on the
  // wave-end key it sweeps the six enemy records through a per-record fire gate,
  // then clears the launch-arm and launch latches to close the wave out.
  fireArmedEnemyProjectilesAndDisarm(m); // end-of-wave object-table cleanup
}
