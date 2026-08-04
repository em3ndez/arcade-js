// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_32bd — a three-way object-walker dispatch keyed on the current board.
 *
 * It reads the board once and routes to one of three object-position handlers, with no range
 * check at all:
 *
 *   • board 1 -> the flat-table walker, which starts or resumes one object's scripted walk.
 *   • board 2 -> that walker's direction-selected twin.
 *   • anything else, including 0 and everything from 3 up -> the two-table record seeder, which
 *     itself does nothing on board 3.
 *
 * The board byte is loaded a SINGLE time and both equality tests read that same value; it is
 * never reloaded between the two compares, so an intervening write could not change the decision.
 * The value only chooses the arm — it is not otherwise interpreted, and each handler re-reads
 * whatever board and record state it needs for itself.
 *
 * The object-record pointer the handlers walk is supplied by the caller, and this routine neither
 * reads nor changes it, so nothing has to be staged before the three calls.
 *
 * NOT CLAIMED: which object or cutscene this drives. What is pinned is the shape — a board-keyed
 * three-way dispatch.
 *
 * LIVE-OUT: memory-only — the whole effect is whatever the chosen handler writes into the object
 * record.
 */

import { BOARD } from "./names.js";
import { loc_342c } from "./loc_342c.js";
import { loc_3478 } from "./loc_3478.js";
import { loc_34b9 } from "./loc_34b9.js";

/**
 * @param {object} m  the machine; the handlers read the register file for themselves.
 * @returns {void}
 */
export function loc_32bd(m) {
  const board = m.mem.read8(BOARD);

  if (board === 0x01) {
    loc_342c(m);
    return;
  }
  if (board === 0x02) {
    loc_3478(m);
    return;
  }
  // Default arm: every other board value (including 0 and >= 3).
  loc_34b9(m);
}
