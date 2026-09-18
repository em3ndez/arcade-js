// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeBoardWhenMarioReachesRescueRow — the rescue-row test in Mario's per-frame position
 * check, for the two odd boards (25m and 75m). Y is a screen coordinate that DECREASES as Mario
 * climbs, and 0x31 is the rescue line: at or below it, return true (keep going); above it, the
 * board is won — fall into the board-won tail (stamps facing, commits the advance, unwinds) and
 * propagate its false.
 *
 * WARNING: use a real compare, not a value test — cp leaves the carry the board-won tail reads to
 * pick Mario's facing. Y arrives in a register from the caller, so it is read off the machine.
 */

import { loc_1e6d } from "./loc_1e6d.js";

export function completeBoardWhenMarioReachesRescueRow(m) {
  const { regs } = m;

  regs.cp(0x31);

  if (!regs.fC) return true;

  return loc_1e6d(m);
}
