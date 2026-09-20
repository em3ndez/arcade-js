// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeBoardWhenMarioReachesRescueRow — the rescue-row test in Mario's per-frame position
 * check, for the two odd boards (25m and 75m). Y is a screen coordinate that DECREASES as Mario
 * climbs, and 0x31 is the rescue line: at or below it, return true (keep going); above it, the
 * board is won — fall into the board-won tail (stamps facing, commits the advance, unwinds) and
 * propagate its false.
 *
 * Y arrives from the caller's A register. Unsigned CP sets carry when A < 0x31, and the board-won
 * tail reads that carry to pick Mario's facing; reaching the tail means A < 0x31, so hand it true.
 */

import { loc_1e6d } from "./loc_1e6d.js";

export function completeBoardWhenMarioReachesRescueRow(m, y = m.regs.a) {
  if (y >= 0x31) return true;

  return loc_1e6d(m, true);
}
