// SPDX-License-Identifier: GPL-3.0-only
import { beginObjectCrossPlayerMove } from "./beginObjectCrossPlayerMove.js";

/**
 * restartObjectMoveRun (ROM 0x1091) -- object-AI state handler for state 12, a "restart the horizontal
 * move run" step in the sixteen-entry object-AI table.
 *
 * WHAT IT IS
 *   Reached when an attacker record's state byte (record+2) holds 12. It ticks the record's sub-counter
 *   (record+3, reused here as a per-run tally), forces the state back to 8, and kicks off a fresh
 *   cross-player horizontal move. Forcing the state to 8 re-enters armDirectedMoveWhenInWindow, the
 *   state-8 handler that arms a directed move once the object is inside its firing window -- so state 12
 *   is how an object loops back to re-arm and sweep across again. See mechanisms.md "The object-AI driver
 *   and its state handlers".
 *
 * ROLE IN THE MACHINE
 *   Called by driveObjectSlot for an active record whose state index is 12; operates on the 32-byte
 *   object record pointed to by IX. Then tail-calls beginObjectCrossPlayerMove, which plans and commits
 *   the actor's next horizontal target X.
 *
 * Grounding: [seen] (names.js cert for 0x1091).
 *
 * LIVE-OUT: record+3 incremented, record+2 set to 8, plus whatever beginObjectCrossPlayerMove writes.
 */
export function restartObjectMoveRun(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Bump the sub-counter (record+3) that tallies this move run, then rewind the state byte to 8 so the
  // object re-enters the arm-window state (armDirectedMoveWhenInWindow) on its next driver pass.
  mem8[record + 3] = mem8[record + 3] + 1;
  mem8[record + 2] = 8;

  // Begin a fresh cross-player horizontal move: pick and commit the actor's next horizontal target X.
  return beginObjectCrossPlayerMove(m, record);
}
