// SPDX-License-Identifier: GPL-3.0-only
import { COORD_DISPATCH_SEL } from "./names.js";
import { loc_96ab, loc_96b7, loc_96c4 } from "./loc_96ab.js";
import { loc_96e2 } from "./loc_96e2.js";
import { loc_96db } from "./loc_96db.js";
import { loc_9700 } from "./loc_96f4.js";

// Computed dispatch: the selector byte (2,4,6,8,10,12) picks a coordinate helper and
// tail-returns its result to this routine's own caller. Slot 0 is unused.
const TABLE = [null, loc_96c4, loc_96b7, loc_96ab, loc_96e2, loc_96db, loc_9700];

export function loc_9677(m, y = m.regs.y) {
  const { mem8 } = m;
  return TABLE[mem8[COORD_DISPATCH_SEL] >> 1](m, y);
}
