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

// Per-frame update driver: runs the nine per-frame passes in order, then tail-delegates to the last one.
export function loc_970b(m) {
  rotateBlasterAroundRim(m);
  spawnEntityIntoFreeSlot(m);
  stepAttractEnemySweepTimer(m);
  tickSpawnSlotTimers(m);
  runObjectMotionScripts(m);
  stepActiveShots(m);
  spawnClimbersFromSourceSlots(m);
  scanAllSlotsForProximity(m);
  ageTimedObjects(m);
  return ageShotsAndAdvanceFrameClock(m);
}
