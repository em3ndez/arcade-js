// SPDX-License-Identifier: GPL-3.0-only
import { loc_2e3e } from "./names.js";
/** loc_5860 — fly one object a step at the pace one fixed velocity table sets; choosing that
 * table is all this entry does, and an incoming pointer is discarded. LIVE-OUT: memory. */

import { flyAlongHeading } from "./flyAlongHeading.js";

const VELOCITY_TABLE = loc_2e3e;

export function loc_5860(m) {
  flyAlongHeading(m, VELOCITY_TABLE);
}
