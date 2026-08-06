// SPDX-License-Identifier: GPL-3.0-only
/** flyAtSlowestSpeed — fly one object a single step at the slowest of the velocity-table speeds. Choosing that table is
 * the whole of what this entry does, and it decides nothing else. LIVE-OUT: memory. */

import { flyAlongHeading } from "./flyAlongHeading.js";

const VELOCITY_TABLE = 0x59d7;

export function flyAtSlowestSpeed(m) {
  flyAlongHeading(m, VELOCITY_TABLE);
}
