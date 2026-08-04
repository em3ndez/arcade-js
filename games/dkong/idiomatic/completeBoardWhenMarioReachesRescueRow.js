// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeBoardWhenMarioReachesRescueRow — the rescue-row test inside Mario's per-frame
 * position check.
 *
 * WHICH BOARDS. This arm serves 25m AND 75m — not the girder board alone. The dispatcher
 * above it peels 100m off to the rivet arm first, then routes on the LOW BIT of the board
 * number, which selects the two ODD boards: 25m and 75m. 50m falls through to a different
 * threshold test entirely.
 *
 * Reached once the dispatcher's earlier column/row checks have narrowed Mario to the
 * situation near Pauline; the caller hands Mario's screen Y position in. This routine
 * decides whether he has climbed high enough to win the board — Y is a screen coordinate
 * that DECREASES as Mario climbs, and 0x31 is the rescue-row line:
 *
 *   • Y at or below the line (Y value >= 0x31, i.e. still down the board, not yet up to
 *     Pauline) -> a normal return (true = "keep going", nothing changes this frame).
 *   • Y above the line (Y value < 0x31, up on Pauline's row) -> the board is won: fall into
 *     the board-won tail, which stamps Mario's sprite facing, commits the board-advance
 *     sub-state, and UNWINDS out of the movement cascade. This routine passes that unwind
 *     signal back unchanged (false = "abort: board won, do not continue").
 *
 * The Y position arrives in a register from the caller, so it is read from the machine
 * register at that boundary rather than taken as a parameter. The threshold comparison also
 * leaves the carry that the board-won tail reads to pick Mario's facing, so it is done as a
 * real compare (carry set on the board-won arm) rather than a bare value test. On THIS path
 * the facing byte is therefore always 0x00, because the board-won arm is the carry-SET arm
 * by construction; the other facing value is reachable only through the dispatcher's own
 * fall-through, which this jump skips.
 *
 * LIVE-OUT: the keep-going / board-won boolean. On the board-won arm Mario's sprite code and
 * the game sub-state are written inside the tail; the normal arm writes nothing at all.
 */

import { loc_1e6d } from "./loc_1e6d.js";

export function completeBoardWhenMarioReachesRescueRow(m) {
  const { regs } = m;

  // Compare Mario's screen Y against the rescue-row line. The compare also leaves the carry
  // the board-won tail reads to select his facing.
  regs.cp(0x31);

  // Still down the board (Y value at or above the line): keep going, nothing changes.
  if (!regs.fC) return true;

  // Up on Pauline's row: the board is won. The tail stamps the facing, commits the
  // board-advance sub-state, and unwinds; propagate its unwind signal (false).
  return loc_1e6d(m);
}
