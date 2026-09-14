// SPDX-License-Identifier: GPL-3.0-only
import { SPIKED_SEGMENT_COUNT, PLAYER_FINE_ANGLE } from "./names.js";
import { rotateBlasterAroundRim } from "./rotateBlasterAroundRim.js";
import { advanceMovingSpike } from "./advanceMovingSpike.js";
import { ageTimedObjects } from "./ageTimedObjects.js";
import { spawnEntityIntoFreeSlot } from "./spawnEntityIntoFreeSlot.js";
import { stepActiveShots } from "./stepActiveShots.js";
import { ageShotsAndAdvanceFrameClock } from "./ageShotsAndAdvanceFrameClock.js";

// Per-frame update chain: clear bit7 of SPIKED_SEGMENT_COUNT, run the five state updaters in order, then when
// PLAYER_FINE_ANGLE is negative (bit7 set) run the extra updater.
export function loc_9729(m) {
  const { mem8 } = m;
  mem8[SPIKED_SEGMENT_COUNT] = mem8[SPIKED_SEGMENT_COUNT] & 0x7f;
  rotateBlasterAroundRim(m);
  advanceMovingSpike(m);
  ageTimedObjects(m);
  spawnEntityIntoFreeSlot(m);
  stepActiveShots(m);
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) ageShotsAndAdvanceFrameClock(m);
}
