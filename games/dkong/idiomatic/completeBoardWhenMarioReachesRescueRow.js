// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeBoardWhenMarioReachesRescueRow — the rescue-row test inside Mario's per-frame position check (sub_1e57).
 * ROM 0x1E7A.
 *
 * WHICH BOARDS. This arm serves **25m AND 75m**, not the girder board alone. The dispatcher
 * at ROM 0x1E57 first sends BOARD 4 to the rivet arm (`bit 2,a`), then executes `rra` at
 * ROM 0x1E5F — which rotates BOARD's **bit 0** into the carry — and `jp c,0x1E7A` at 0x1E63
 * therefore selects the ODD boards, BOARD 1 (25m) and BOARD 3 (75m). BOARD 2 falls through
 * to the `cp 0x51` threshold instead. (An earlier header here called this "the girder-board
 * rescue-row test … Reached on a girder board"; that was wrong.)
 *
 * Reached once sub_1e57's earlier column/row checks have narrowed Mario to the situation
 * near Pauline; the caller hands Mario's screen Y position in. This
 * routine decides whether he has climbed high enough to win the board — Y is a screen
 * coordinate that DECREASES as Mario climbs, and 0x31 is the rescue-row line:
 *
 *   • Y at or below the line (Y value >= 0x31, i.e. still down the board, not yet up to
 *     Pauline) -> a normal return (true = "keep going", nothing changes this frame).
 *   • Y above the line (Y value < 0x31, up on Pauline's row) -> the board is won: fall into
 *     loc_1e6d, which stamps Mario's sprite facing, commits the board-advance sub-state, and
 *     UNWINDS out of the movement cascade. This routine returns loc_1e6d's boolean unwind
 *     signal unchanged (false = "abort: board won, do not continue").
 *
 * The Y position arrives in a register from the STILL-TRANSLATED caller (sub_1e57), so it is
 * read from the machine register at this oracle boundary rather than taken as a parameter;
 * it promotes to a parameter once that caller is idiomatic. The threshold comparison also
 * leaves the carry that loc_1e6d reads to pick Mario's facing, so it is done as a real
 * compare (carry set on the board-won arm) rather than a bare value test. On THIS path the
 * facing byte is therefore always 0x00: the board-won arm is the carry-SET arm by
 * construction, and loc_1e6d writes 0x00 for carry set. The other facing value is reachable
 * only through the dispatcher's own fall-through at ROM 0x1E6C, which this jump skips.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e7a.test.js.
 * GATE:     crafted-entry + captured. An attract run dispatches 0x1E7A thousands of times
 *           but ALWAYS on the normal-return arm (Mario never climbs to the rescue row in the
 *           demo), so real captured dispatches cover only that arm; the crafted gate sweeps
 *           the Y position EXHAUSTIVELY over all 256 values — the routine's only input — to
 *           cover both arms and the exact threshold boundary. The oracle's normal `ret`
 *           (Y-high arm) and its two-level unwind via loc_1e6d/0x1E85 (Y-low arm) are modeled
 *           on the candidate so pc + SP line up. Teeth: an inverted threshold, a
 *           wrong-boundary twin, and a dropped-carry-marshal twin, each caught.
 * LIVE-OUT: the board-won arm writes MARIO_SPRITE_RECORD + SPRITE_CODE and GAME_SUBSTATE
 *           (both inside the callees) and returns false; the normal arm writes nothing and
 *           returns true. Otherwise memory-only — the oracle's residual registers/flags and
 *           its returns are dead ABI.
 * NAMES:    reads Mario's Y from the caller's register; loc_1e6d (ROM 0x1E6D) direct-called
 *           on the board-won arm. 0x31 is the rescue-row Y threshold — an immediate compared
 *           against the sprite Y, with no ram.js name, so it stays hex.
 */

import { loc_1e6d } from "./loc_1e6d.js"; // ROM 0x1E6D

export function completeBoardWhenMarioReachesRescueRow(m) {
  const { regs } = m;

  // Compare Mario's screen Y against the rescue-row line. The compare also leaves the carry
  // that loc_1e6d reads to select his facing on the board-won arm.
  regs.cp(0x31);

  // Still down the board (Y value at or above the line): keep going, nothing changes.
  if (!regs.fC) return true;

  // Up on Pauline's row: the board is won. loc_1e6d stamps the facing, commits the
  // board-advance sub-state, and unwinds; propagate its unwind signal (false).
  return loc_1e6d(m);
}
