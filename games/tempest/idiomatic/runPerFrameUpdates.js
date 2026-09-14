// SPDX-License-Identifier: GPL-3.0-only
import { rotateBlasterAroundRim } from "./rotateBlasterAroundRim.js";
import { spawnEntityIntoFreeSlot } from "./spawnEntityIntoFreeSlot.js";
import { stepAttractEnemySweepTimer } from "./stepAttractEnemySweepTimer.js";
import { tickSpawnSlotTimers } from "./tickSpawnSlotTimers.js";
import { runObjectMotionScripts } from "./runObjectMotionScripts.js";
import { stepActiveShots } from "./stepActiveShots.js";
import { spawnClimbersFromSourceSlots } from "./spawnClimbersFromSourceSlots.js";
import { scanAllSlotsForProximity } from "./scanAllSlotsForProximity.js";
import { ageTimedObjects } from "./ageTimedObjects.js";
import { ageShotsAndAdvanceFrameClock } from "./ageShotsAndAdvanceFrameClock.js";

/**
 * runPerFrameUpdates — the per-frame gameplay update driver. ROM 0x970b.
 *
 * Role in the machine: this is the top of Tempest's once-per-frame simulation. Every displayed frame it
 * fans out to the nine subsystem passes that advance the live playfield — the player's blaster on the rim,
 * enemy spawning and timers, enemy motion scripts, player shots, climbers, proximity/collision scanning,
 * and object aging — then tail-delegates to the final pass that ages shots and ticks the frame clock. It
 * owns no state of its own; it is pure sequencing, and the fixed order is load-bearing (spawns before
 * motion, motion before shot stepping, aging last).
 *
 * Behavior: calls the nine passes in fixed order and returns the result of the tenth (tail) pass.
 * Grounding: [seen].
 */
export function runPerFrameUpdates(m) {
  rotateBlasterAroundRim(m);            // move the player's blaster around the tube rim
  spawnEntityIntoFreeSlot(m);           // seat a newly spawned enemy into a free slot
  stepAttractEnemySweepTimer(m);        // advance the attract-mode enemy sweep timer
  tickSpawnSlotTimers(m);               // count down the per-slot spawn timers
  runObjectMotionScripts(m);            // run every occupied slot's motion script
  stepActiveShots(m);                   // advance active player/enemy shots
  spawnClimbersFromSourceSlots(m);      // spawn climbers up the lanes from source slots
  scanAllSlotsForProximity(m);          // proximity / collision scan across all slots
  ageTimedObjects(m);                   // age transient timed objects
  return ageShotsAndAdvanceFrameClock(m); // tail: age shots + tick the frame clock
}
