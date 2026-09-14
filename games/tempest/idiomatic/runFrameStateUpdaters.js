// SPDX-License-Identifier: GPL-3.0-only
import { SPIKED_SEGMENT_COUNT, PLAYER_FINE_ANGLE } from "./names.js";
import { rotateBlasterAroundRim } from "./rotateBlasterAroundRim.js";
import { advanceMovingSpike } from "./advanceMovingSpike.js";
import { ageTimedObjects } from "./ageTimedObjects.js";
import { spawnEntityIntoFreeSlot } from "./spawnEntityIntoFreeSlot.js";
import { stepActiveShots } from "./stepActiveShots.js";
import { ageShotsAndAdvanceFrameClock } from "./ageShotsAndAdvanceFrameClock.js";

/**
 * runFrameStateUpdaters -- the per-frame world-update chain. ROM 0x9729.
 *
 * Role in the machine: once per game update this fires the sequence of routines that advance everything
 * that moves on the tube -- the player's rim rotation, the spikes, the timed objects, new spawns, and the
 * active shots -- in a fixed order so each updater sees the results of the ones before it. It is the
 * "tick the world" step of the frame; the caller runs it inside the main loop.
 *
 * Behavior: first clear bit7 of SPIKED_SEGMENT_COUNT ($123), the per-frame flag that shares that tally
 * cell, masking it back to 0..0x7f so this frame starts with a clean count. Then call the five updaters in
 * order: rotateBlasterAroundRim ($9749) turns the spinner/aim into the player's new rim angle;
 * advanceMovingSpike ($97f8) steps the moving spike; ageTimedObjects ($a416) ages timed objects;
 * spawnEntityIntoFreeSlot ($a23f) seats a new enemy into a free slot; stepActiveShots ($a18f) advances
 * live shots. Finally, only when PLAYER_FINE_ANGLE ($201) is negative (bit7 set -- the rotation/
 * object-pending flag), run the extra updater ageShotsAndAdvanceFrameClock ($a504).
 *
 * Live-out: no cell is written directly except the bit7 clear of SPIKED_SEGMENT_COUNT; the frame's real
 * output is the composed state left by the six callees. Grounding: [seen].
 */
export function runFrameStateUpdaters(m) {
  const { mem8 } = m;
  mem8[SPIKED_SEGMENT_COUNT] = mem8[SPIKED_SEGMENT_COUNT] & 0x7f; // drop the per-frame bit7, keep the tally
  rotateBlasterAroundRim(m);                  // player rim rotation from spinner/aim
  advanceMovingSpike(m);                      // step the moving spike
  ageTimedObjects(m);                         // age timed objects
  spawnEntityIntoFreeSlot(m);                 // seat a new enemy into a free slot
  stepActiveShots(m);                         // advance the live shots
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) ageShotsAndAdvanceFrameClock(m); // extra pass only when $201 bit7 set
}
