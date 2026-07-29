// SPDX-License-Identifier: GPL-3.0-only
/**
 * startNextDigSpawn — start the next queued dig-object spawn, or clear the spawn-active flag
 * when nothing is queued.  ROM 0x2bf2.
 *
 * The dig subsystem keeps a 24-slot queue of pending object positions at DROP_QUEUE (0x80c3)
 * (each slot holds a candidate position, 0 = empty). This routine runs when no spawn
 * is currently active and it is time to consider starting one: it walks the queue
 * looking for the first occupied slot.
 *   - A slot is occupied -> hand off to the placement path, which picks one occupied
 *     slot at random, clears it, paints its tile into the maze, raises the
 *     spawn-active flag, and flags whether the new cell overlaps the player.
 *   - The whole queue is empty -> clear the spawn-active flag (nothing is spawning, so
 *     a fresh spawn is permitted next time) and fall through to the per-frame
 *     background/terrain animation.
 * Both hand-offs are tail calls: whichever one runs returns straight to this routine's
 * own caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2bf2.test.js.
 * GATE:     RAM-only (the dead stack scratch just below the entry stack pointer is
 *           excluded); real captured attract dispatches exercise the occupied path,
 *           a crafted empty-queue entry exercises the empty path.
 * LIVE-OUT: memory only — the spawn-active flag on the empty path, plus whatever the
 *           hand-off writes. The scan runs in locals and reads no register live-in;
 *           neither hand-off consumes a register from the scan, so nothing has to be
 *           marshalled across it.
 * NAMES:    HAZARD_ACTIVE_COUNT (0x80bd), DROP_QUEUE (0x80c3, base of the 24-slot pending
 *           queue) from ram.js — the queue's exact per-slot contents are still not pinned.
 *           The occupied hand-off is the already-decompiled spawnPendingDigObject; the
 *           animation hand-off (0x2f71) is the decompiled advanceChamberCreature, called
 *           directly.
 */

import { HAZARD_ACTIVE_COUNT, DROP_QUEUE } from "./ram.js";
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
