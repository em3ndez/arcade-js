// SPDX-License-Identifier: GPL-3.0-only
/** loc_5854 — fly one object a single step at the pace one fixed table of velocity samples sets. Choosing that table
 * is the whole of what this entry does; a pointer a caller held on the way in is discarded. LIVE-OUT: memory. */

import { flyAlongHeading } from "./flyAlongHeading.js";
import { OPENING_ERA_VELOCITY_TABLE } from "./names.js";

const VELOCITY_TABLE = OPENING_ERA_VELOCITY_TABLE;

export function loc_5854(m) {
  flyAlongHeading(m, VELOCITY_TABLE);
}
