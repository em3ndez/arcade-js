// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitMoveToStoredOrPlayerTargetX -- alternate horizontal target-select branch for an attacking object.
 *
 * WHAT IT IS
 *   A two-way selector over the object record (defaulting to IX). It reads bit 0 of the object-table mode
 *   flag at OBJ_TABLE (0x42d0): if set, the object is one that carries its own destination, so it steers
 *   toward the stored target X held at OBJ_TABLE+0x19 via commitMoveToTargetX (0x0df6); if clear, it falls
 *   back to the ordinary player-crossover pick, commitMoveAcrossPlayerX (0x0ddd).
 *
 * ROLE IN THE MACHINE
 *   Chooses an attacking object's next horizontal target. Reached from advanceActorPhaseAndCommitMove
 *   (object-AI state 2) for the object kind whose (ix+7)&0x70 == 0x60; other kinds go straight to the
 *   cross-player picker. Both branches end at commitMoveToTargetX, which sets up the actual horizontal run.
 *
 * ROM 0x0e20.  Grounding: [seen].
 *
 * LIVE-OUT: the record's move fields, written by whichever mover ran (stored-target or crossover).
 */
import { commitMoveAcrossPlayerX } from "./commitMoveAcrossPlayerX.js";
import { commitMoveToTargetX } from "./commitMoveToTargetX.js";
import { OBJ_TABLE } from "./names.js";

const STORED_TARGET_X = OBJ_TABLE + 0x19; // the mode flag's record holds its target X at this field

export function commitMoveToStoredOrPlayerTargetX(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Mode flag bit 0 set -> this object has its own stored destination: steer straight to it.
  if (mem8[OBJ_TABLE] & 0x01) {
    return commitMoveToTargetX(m, mem8[STORED_TARGET_X], record);
  }
  // Otherwise pick a target on the far side of the player and commit the crossover move.
  return commitMoveAcrossPlayerX(m, record);
}
