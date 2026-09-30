// SPDX-License-Identifier: GPL-3.0-only
import { loc_2e3e } from "./names.js";
/** flyAtSecondFastestSpeed — fly one object a step at the pace one fixed velocity table sets; choosing that
 * table is all this entry does, and an incoming pointer is discarded. LIVE-OUT: memory. */

import { flyAlongHeading } from "./flyAlongHeading.js";

const VELOCITY_TABLE = loc_2e3e;

export function flyAtSecondFastestSpeed(m, object = m.regs.ix, sprite = m.regs.iy) {
  flyAlongHeading(m, VELOCITY_TABLE, object, sprite);
}
