// SPDX-License-Identifier: GPL-3.0-only
// Per-object step: bump the object's sub-counter, set its state byte to 8, then hand off to the
// cross-player move tail that picks and commits the actor's next horizontal target.
import { beginObjectCrossPlayerMove } from "./beginObjectCrossPlayerMove.js";

export function loc_1091(m, record = m.regs.ix) {
  const { mem8 } = m;

  mem8[record + 3] = mem8[record + 3] + 1;
  mem8[record + 2] = 8;

  return beginObjectCrossPlayerMove(m, record);
}
