// SPDX-License-Identifier: GPL-3.0-only
// Shared object tail: pick and commit the actor's horizontal target, then arm two of its move
// counters for the fresh move.
import { commitMoveAcrossPlayerX } from "./commitMoveAcrossPlayerX.js";

export function loc_0f7b(m, record = m.regs.ix) {
  const { mem8 } = m;

  commitMoveAcrossPlayerX(m, record);

  mem8[record + 0x18] = 3;
  mem8[record + 0x10] = 100;  // move throttle
}
