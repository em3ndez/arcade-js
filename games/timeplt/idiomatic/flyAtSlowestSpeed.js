// SPDX-License-Identifier: GPL-3.0-only
import { loc_59d7 } from "./names.js";
/** flyAtSlowestSpeed — fly one object a single step at the slowest of the velocity-table speeds. Choosing that table is
 * the whole of what this entry does, and it decides nothing else. LIVE-OUT: memory. */

import { flyAlongHeading } from "./flyAlongHeading.js";

const VELOCITY_TABLE = loc_59d7;

export function flyAtSlowestSpeed(m) {
  flyAlongHeading(m, VELOCITY_TABLE);
}
