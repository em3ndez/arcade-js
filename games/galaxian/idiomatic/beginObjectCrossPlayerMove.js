// SPDX-License-Identifier: GPL-3.0-only

/**
 * beginObjectCrossPlayerMove (ROM 0x0f7b) — shared object-AI tail that starts a fresh horizontal run.
 *
 * WHAT IT IS
 *   Given an attacker's object record at IX, it picks and commits a horizontal target on the far/opposite
 *   side of the player-X reference, then arms two of the record's motion counters so the following frames
 *   actually walk the object toward that target.
 *
 * ROLE IN THE MACHINE
 *   Called by the state-8 arm-window handler (armDirectedMoveWhenInWindow, 0x0f66) while cruising, and by
 *   the state-12 move-run restart (restartObjectMoveRun, 0x1091). The target pick is delegated to
 *   commitMoveAcrossPlayerX (0x0ddd), one of the shared motion-planning primitives (mechanisms.md
 *   "object AI"). record+0x18 is the flight-curve step seed later consumed by advanceObjectFlightCurve
 *   (0x116b): seeding it to 3 yields (3 & 3) + 1 = 4 curve steps. record+0x10 is the object's move throttle.
 *
 * ROM 0x0f7b.  Grounding: [seen].
 *
 * LIVE-OUT: the object record at IX — record+0x18 (flight-curve step seed = 3) and record+0x10 (move
 *   throttle = 100) — plus whatever commitMoveAcrossPlayerX commits (the chosen target X and its counters).
 */
import { commitMoveAcrossPlayerX } from "./commitMoveAcrossPlayerX.js";

export function beginObjectCrossPlayerMove(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Pick and commit the horizontal target across the player-X reference for this object.
  commitMoveAcrossPlayerX(m, record);

  // Arm the fresh move: seed the flight-curve step count (record+0x18) and the move throttle (record+0x10).
  mem8[record + 0x18] = 3;
  mem8[record + 0x10] = 100;  // move throttle
}
