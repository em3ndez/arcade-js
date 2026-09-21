// SPDX-License-Identifier: GPL-3.0-only
/**
 * checkBoardWonByType — Mario's per-frame board-won check, routed by board type:
 *   • rivet (100m) — win is the rivet count, defer entirely (position never read);
 *   • odd boards (25m AND 75m, board bit 0) — win is the rescue-row position near Pauline;
 *   • 50m — won once Mario climbs above a fixed line (screen Y decreases as he climbs).
 * On the 50m won arm, Mario's X high bit picks his sprite facing, rotated into carry for the
 * completion arm.
 *
 * Returns a protocol: true = not won, cascade continues; false = won, cascade already unwound.
 *
 * LIVE-OUT: the protocol return. No memory written here; won-arm writes happen further down.
 */

import { BOARD, MARIO_Y, MARIO_X } from "./names.js";
import { completeRivetBoardWhenCleared } from "./completeRivetBoardWhenCleared.js";
import { completeBoardWhenMarioReachesRescueRow } from "./completeBoardWhenMarioReachesRescueRow.js";
import { loc_1e6d } from "./loc_1e6d.js";

export function checkBoardWonByType(m) {
  const { mem8 } = m;

  const board = mem8[BOARD];

  if ((board & 0x04) !== 0) return completeRivetBoardWhenCleared(m);

  const marioY = mem8[MARIO_Y];

  if ((board & 0x01) !== 0) return completeBoardWhenMarioReachesRescueRow(m, marioY);

  // Below the line (larger Y): nothing changes this frame.
  if (marioY >= 0x51) return true;

  // Mario's X high bit is the facing flag the tail reads.
  const marioX = mem8[MARIO_X];
  return loc_1e6d(m, (marioX & 0x80) !== 0);
}
