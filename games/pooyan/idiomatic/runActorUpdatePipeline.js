// SPDX-License-Identifier: GPL-3.0-only
import { loc_5e78 } from "./loc_5e78.js";
import { loc_5f6a } from "./loc_5f6a.js";
import { resolveObjectProximityHitsBothSlots } from "./resolveObjectProximityHitsBothSlots.js";
import { resolveProjectileCollisionsBothActorSlots } from "./resolveProjectileCollisionsBothActorSlots.js";
import { loc_5df7 } from "./loc_5df7.js";
import { flagTamperOnRound5ChecksumMiss } from "./flagTamperOnRound5ChecksumMiss.js";
import { loc_5d4d } from "./loc_5d4d.js";
import { loc_5b86 } from "./loc_5b86.js";
import { scanActorCollisionsBothSlots } from "./scanActorCollisionsBothSlots.js";
import { loc_5d0b } from "./loc_5d0b.js";
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
  loc_5e78(m); // odd-round actor sweep
  loc_5f6a(m);
  resolveObjectProximityHitsBothSlots(m);
  resolveProjectileCollisionsBothActorSlots(m);
  loc_5df7(m);
  flagTamperOnRound5ChecksumMiss(m); // round-5 checksum tamper tally
  loc_5d4d(m);
  loc_5b86(m);
  scanActorCollisionsBothSlots(m); // two-pass actor collision driver
  loc_5d0b(m);
  fireArmedEnemyProjectilesAndDisarm(m); // end-of-wave object-table cleanup
}
