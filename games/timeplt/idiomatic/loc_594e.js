// SPDX-License-Identifier: GPL-3.0-only
/** loc_594e — hand back the perpendicular component pair an object's heading calls for, at the pace one fixed table
 * of velocity samples sets. Choosing it is all this entry does; an incoming pointer is discarded. LIVE-OUT: the pair. */

import { velocityForHeading } from "./velocityForHeading.js";
import { OPENING_ERA_VELOCITY_TABLE } from "./names.js";

const VELOCITY_TABLE = OPENING_ERA_VELOCITY_TABLE;

export function loc_594e(m) {
  velocityForHeading(m, VELOCITY_TABLE);
}
