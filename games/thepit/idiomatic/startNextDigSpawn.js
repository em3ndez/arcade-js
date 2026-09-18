// SPDX-License-Identifier: GPL-3.0-only
/**
 * startNextDigSpawn — start the next queued dig-object spawn, or clear the spawn-active flag when nothing is queued.
 *
 * The dig subsystem keeps a 24-slot queue of pending object positions at DROP_QUEUE (0 =
 * empty slot). This runs when no spawn is active: it walks the queue for the first occupied
 * slot. Occupied — hand off to the placement path (which picks one occupied slot at random,
 * clears it, paints its tile, raises the spawn-active flag, and flags a player overlap).
 * Empty — clear the spawn-active flag and fall through to the per-frame background animation.
 * Both hand-offs are tail calls returning to this routine's caller.
 */

import { HAZARD_ACTIVE_COUNT, DROP_QUEUE } from "./names.js";
import { spawnPendingDigObject } from "./spawnPendingDigObject.js";
import { advanceChamberCreature } from "./advanceChamberCreature.js";

export function startNextDigSpawn(m) {
  const { mem8 } = m;

  // Walk the 24-slot pending queue; the first occupied slot means work to place.
  for (let slot = 0; slot < 24; slot++) {
    if (mem8[DROP_QUEUE + slot] !== 0) {
      // Something is queued -> spawn it (this also raises the spawn-active flag).
      return spawnPendingDigObject(m);
    }
  }

  // Queue empty: nothing is spawning, so allow a fresh spawn next time round.
  mem8[HAZARD_ACTIVE_COUNT] = 0;
  // Carry on with the per-frame background/terrain animation.
  return advanceChamberCreature(m);
}
