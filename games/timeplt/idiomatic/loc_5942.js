// SPDX-License-Identifier: GPL-3.0-only
/** loc_5942 — hand back the component pair an object's heading calls for, at the pace one fixed
 * velocity table sets; choosing it is all this entry does. LIVE-OUT: the pair. */

import { velocityForHeading } from "./velocityForHeading.js";
import { loc_59d7 } from "./names.js";

const VELOCITY_TABLE = loc_59d7;

export function loc_5942(m) {
  return velocityForHeading(m, VELOCITY_TABLE);
}
