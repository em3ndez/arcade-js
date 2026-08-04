// SPDX-License-Identifier: GPL-3.0-only
/**
 * checkBoardWonByType — Mario's per-frame board-won check: decide whether the current board has
 * been won, routed by board type, and hand off to the arm that completes it.
 *
 * Called each frame while Mario is on a board. It reads the board type and, on the frame the win
 * condition is met, defers to the arm that stamps the win, commits the board-advance sub-state and
 * unwinds the movement cascade. Three arms:
 *
 *   • The RIVET board (100m) — the win is the rivet count, not Mario's position, so this arm
 *     defers entirely and Mario's coordinates are never even read on it.
 *   • The ODD boards — 25m AND 75m together. The selector is board bit 0, so both take this arm;
 *     it is not the 25m board alone. The win is positional, at the rescue row near Pauline, tested
 *     against Mario's screen Y.
 *   • The remaining board (50m) — won once Mario has climbed above a fixed line. Screen Y
 *     DECREASES as he climbs, so "above" means a Y strictly below that line. At or below it,
 *     nothing changes this frame and the cascade keeps going; above it the board is won.
 *
 * On the won arm of the last case, Mario's X high bit picks the sprite facing he is left standing
 * in — that is the one value this routine derives itself before handing off.
 *
 * THE RETURN IS A PROTOCOL, threaded straight out of whichever arm ran:
 *   true  — the board is not won, so the movement cascade continues this frame;
 *   false — the board was won and the cascade has already unwound, so the caller must NOT continue.
 *
 * LIVE-OUT: the protocol return. This routine writes no memory of its own; every write on a won
 * arm happens further down.
 */

import { BOARD, MARIO_Y, MARIO_X } from "./names.js";
import { completeRivetBoardWhenCleared } from "./completeRivetBoardWhenCleared.js";
import { completeBoardWhenMarioReachesRescueRow } from "./completeBoardWhenMarioReachesRescueRow.js";
import { loc_1e6d } from "./loc_1e6d.js";

export function checkBoardWonByType(m) {
  const { regs, mem } = m;

  const board = mem.read8(BOARD);

  // Rivet (100m) board: the win is the rivet count, not position — defer entirely.
  if ((board & 0x04) !== 0) return completeRivetBoardWhenCleared(m);

  // The other boards test Mario's position. His screen Y goes into the accumulator, where the
  // rescue-row test reads it, and the climb test below uses it too.
  const marioY = mem.read8(MARIO_Y);
  regs.a = marioY;

  // The ODD boards (25m and 75m, selected by board bit 0): the rescue-row test near Pauline
  // decides the win.
  if ((board & 0x01) !== 0) return completeBoardWhenMarioReachesRescueRow(m);

  // Remaining board: won once Mario has climbed above the line (screen Y decreases as he
  // climbs). At or below it, nothing changes this frame — keep going.
  if (marioY >= 0x51) return true;

  // Above the line — the board is won. Mario's X high bit picks the facing he is left in;
  // rotate it into the carry, which is where the completion arm reads it.
  regs.a = mem.read8(MARIO_X);
  regs.rla();
  return loc_1e6d(m);
}
