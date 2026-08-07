// SPDX-License-Identifier: GPL-3.0-only
/** loc_5860 — fly one object a step at the pace one fixed velocity table sets; choosing that
 * table is all this entry does, and an incoming pointer is discarded. LIVE-OUT: memory. */

import { flyAlongHeading } from "./flyAlongHeading.js";

const VELOCITY_TABLE = 0x2e3e;

export function loc_5860(m) {
  flyAlongHeading(m, VELOCITY_TABLE);
}
