// SPDX-License-Identifier: GPL-3.0-only
/**
 * armDirectedMoveWhenInWindow -- object-AI state 8: cruise until in the strike window, then commit a move.
 *
 * WHAT IT IS
 *   One of the object-AI motion-planner states that steer a diving Galaxian. It is dispatch state 8: an
 *   "arm window" that keeps the attacker cruising across the screen until both a per-object arm counter
 *   and the object's position have entered a fixed horizontal window, at which point it commits a directed
 *   move toward the player and steps the planner on.
 *
 * ROLE IN THE MACHINE
 *   Called with the 32-byte object record in IX (see mechanisms.md "the object records"). Each frame it
 *   bumps the arm counter at record+3. Until BOTH that counter and the position byte at record+4 sit
 *   inside the [96,160) window, it defers to the shared cross-player move tail beginObjectCrossPlayerMove
 *   (the attacker keeps sweeping across). Once both are in-window it: advances the planner sub-state
 *   record+2 by two (leaving this state); seeds the move timers record+0x10=3 and record+0x11=12; clears
 *   the heading record+5 and record+0x13; and sets the move direction record+6 from comparing the player
 *   reference-X loc_4202 against the object's position record+4. State 12 (restartObjectMoveRun) forces the
 *   planner back to state 8 to re-arm this window.
 *
 * ROM 0x0f66.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the object record's counter, sub-state, move timers, heading and direction
 * fields (or, on the not-yet-in-window path, whatever beginObjectCrossPlayerMove writes). No register result.
 */
import { beginObjectCrossPlayerMove } from "./beginObjectCrossPlayerMove.js";
import { loc_4202 } from "./names.js";
import { u8 } from "../../../core/int.js";

// The strike window is [96,160): a value is inside it when the unsigned distance above 96 is under 64.
const WINDOW_LO = 96, WINDOW_SPAN = 64; // in-window when u8(field-96) < 64, i.e. field in [96,160)

const inWindow = (v) => u8(v - WINDOW_LO) < WINDOW_SPAN;

export function armDirectedMoveWhenInWindow(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Tick the per-object arm counter (record+3) up one, wrapping at the byte boundary. This counter and
  // the position field together gate when the attacker is allowed to commit its directed move.
  mem8[record + 0x03] = u8(mem8[record + 0x03] + 1);

  // Not yet in the strike window (either the arm counter or the position record+4 is outside [96,160)):
  // keep the attacker cruising via the shared cross-player move tail and return.
  if (!inWindow(mem8[record + 0x03]) || !inWindow(mem8[record + 0x04])) {
    return beginObjectCrossPlayerMove(m, record);
  }

  // Both in-window: leave state 8 by advancing the planner sub-state (record+2) by two, then arm a fresh
  // directed run -- seed the two move timers (record+0x10, record+0x11) and clear the heading fields
  // (record+5, record+0x13) so the new move starts clean.
  mem8[record + 0x02] = u8(mem8[record + 0x02] + 2);
  mem8[record + 0x10] = 3;
  mem8[record + 0x11] = 12;
  mem8[record + 0x05] = 0;
  mem8[record + 0x13] = 0;

  // Pick the move direction (record+6) from the ship: if the player reference-X loc_4202 is left of the
  // object's position (record+4), head one way (1), otherwise the other (0) -- steering the dive toward
  // the player's current column.
  const referenceBelow = mem8[loc_4202] < mem8[record + 0x04];
  mem8[record + 0x06] = referenceBelow ? 1 : 0;
}
