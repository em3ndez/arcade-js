// SPDX-License-Identifier: GPL-3.0-only
/** flyAtFastestSpeed — fly an object ahead at the pace one fixed table of velocity samples sets. Choosing that table is the whole of what this entry does; a pointer a caller held on the way in is discarded. LIVE-OUT: memory.
 * One call is one step; the table is VELOCITY_TABLE_08FA, the fastest of the ladder (peak 331). */

import { flyAlongHeading } from "./flyAlongHeading.js";
import { VELOCITY_TABLE_08FA } from "./names.js";

const VELOCITY_TABLE = VELOCITY_TABLE_08FA;

export function flyAtFastestSpeed(m, object = m.regs.ix, sprite = m.regs.iy) {
  flyAlongHeading(m, VELOCITY_TABLE, object, sprite);
}
