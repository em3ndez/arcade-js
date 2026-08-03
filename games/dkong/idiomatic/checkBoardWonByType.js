// SPDX-License-Identifier: GPL-3.0-only
/**
 * checkBoardWonByType — Mario's per-frame board-won position check: decide whether the current
 * board has been won, dispatched by board type, and hand off to the arm that completes
 * it.  ROM 0x1E57.
 *
 * Called each frame while Mario is on a board. It routes on the board type and, on the
 * frame the win condition is met, defers to the arm that stamps the win, commits the
 * board-advance sub-state, and unwinds the movement cascade. The three arms:
 *
 *   • Rivet (100m) board — the win is the rivet count, not Mario's position, so this
 *     defers ENTIRELY to completeRivetBoardWhenCleared (wins the frame the last rivet is
 *     gone). Mario's coordinates are never read on this arm.
 *   • The ODD boards, 25m AND 75m — the win is positional at the rescue row near Pauline,
 *     tested by completeBoardWhenMarioReachesRescueRow against Mario's screen Y. The
 *     selector is ROM 0x1E5F's `rra`, which rotates BOARD's bit 0 into the carry, so
 *     `jp c,0x1E7A` takes BOARD 1 and BOARD 3 — this is not "the girder board" alone.
 *   • The remaining board (50m) — won once Mario has climbed above the 0x51 line (screen Y
 *     DECREASES as he climbs, so "above" means Y strictly below 0x51). At or below the
 *     line nothing changes this frame — keep going. Above it the board is won: loc_1e6d
 *     stamps his sprite facing (chosen from his X high bit), commits the advance, and
 *     unwinds.
 *
 * The return is the caller-skip signal threaded through this whole check, passed straight
 * out of whichever arm ran:
 *   true  — normal: the board is not won, so the movement cascade continues this frame.
 *   false — the board was won and the cascade unwound, so the caller must NOT continue.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the arms take honest args): completeBoardWhenMarioReachesRescueRow and
 * loc_1e6d are idiomatic but still take their inputs in registers, so this routine loads
 * exactly what the oracle's jump sites load — Mario's screen Y before completeBoardWhenMarioReachesRescueRow (it reads
 * the Y from the accumulator), and Mario's X rotated so its high bit lands in the carry
 * before loc_1e6d (the facing selector it reads). completeRivetBoardWhenCleared reads only
 * RAM, so its arm needs no marshalling.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): promoted as the DISPATCHER — its
 * board-type routing role is corroborated by two English-named board-completion callees
 * (completeRivetBoardWhenCleared on the rivet arm; enterBoardAdvanceAndUnwind via loc_1e6d) and it
 * reads named BOARD / MARIO_X / MARIO_Y. Of its two positional-test arms,
 * completeBoardWhenMarioReachesRescueRow was promoted in the naming pass that also corrected
 * this dispatcher's board routing (ROM 0x1E5F's `rra` selects the ODD boards — 25m AND 75m,
 * not "the girder board"); loc_1e6d still stays loc_, which reflects ungrounded arm
 * INTERNALS, not a gap in the dispatcher's grounded role.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e57.test.js.
 * GATE:     crafted-entry + captured. Attract only plays the girder board and never wins
 *           it, so real captured 0x1E57 dispatches cover ONLY the girder normal-return arm;
 *           crafted entries drive every arm — rivet (won / not-won), girder (Y swept over
 *           all 256 values across the rescue-row boundary), and the climb arm (Y swept ×
 *           both X-high-bit facings across the 0x51 line). The oracle's normal `ret` and its
 *           two-level board-won unwind are modeled on the candidate from its boolean return
 *           so pc + SP line up; the popped return bytes sit in STACK_SCRATCH (excluded by
 *           contract). Teeth: wrong board-type masks, a shifted climb line, and dropped
 *           Y / carry marshals (proving both register hand-offs are load-bearing), each caught.
 * LIVE-OUT: memory-only + the boolean caller-skip return. The routine writes no RAM itself;
 *           the won arms write inside their callees (Mario's facing byte and GAME_SUBSTATE).
 *           The oracle's residual registers/flags and its return-stack churn are dead ABI.
 * NAMES:    BOARD (0x6227), MARIO_Y (0x6205), MARIO_X (0x6203) from ram.js. RIVETS_LEFT and
 *           the won-path writes (0x694D facing, GAME_SUBSTATE) live inside the callees. The
 *           board-type bits 0x04 (rivet) / 0x01 (girder) are bit flags and the climb line
 *           0x51 is a screen-Y threshold with no ram.js name (mirroring completeBoardWhenMarioReachesRescueRow's 0x31), so
 *           all three stay as literals.
 */

import { BOARD, MARIO_Y, MARIO_X } from "./ram.js";
import { completeRivetBoardWhenCleared } from "./completeRivetBoardWhenCleared.js"; // ROM 0x1E80
import { completeBoardWhenMarioReachesRescueRow } from "./completeBoardWhenMarioReachesRescueRow.js"; // ROM 0x1E7A
import { loc_1e6d } from "./loc_1e6d.js"; // ROM 0x1E6D

export function checkBoardWonByType(m) {
  const { regs, mem } = m;

  const board = mem.read8(BOARD);

  // Rivet (100m) board: the win is the rivet count, not position — defer entirely.
  if ((board & 0x04) !== 0) return completeRivetBoardWhenCleared(m);

  // The other boards test Mario's position. Load his screen Y — completeBoardWhenMarioReachesRescueRow reads it as a
  // register live-in (its ABI is not yet promoted), and the climb test below uses it too.
  const marioY = mem.read8(MARIO_Y);
  regs.a = marioY;

  // The ODD boards (BOARD 1 = 25m, BOARD 3 = 75m — the oracle's `rra` puts bit 0 in the carry):
  // the rescue-row test near Pauline decides the win.
  if ((board & 0x01) !== 0) return completeBoardWhenMarioReachesRescueRow(m);

  // Remaining boards: won once Mario has climbed above the 0x51 line (screen Y decreases
  // as he climbs). At or below it, nothing changes this frame — keep going.
  if (marioY >= 0x51) return true;

  // Above the line — the board is won. Mario's X high bit picks his facing; leave it in
  // the carry loc_1e6d reads, then hand off (it stamps the facing, commits the board-
  // advance sub-state, and unwinds the movement cascade).
  regs.a = mem.read8(MARIO_X);
  regs.rla();
  return loc_1e6d(m);
}
