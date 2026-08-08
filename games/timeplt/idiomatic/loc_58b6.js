// SPDX-License-Identifier: GPL-3.0-only
/** loc_58b6 — fly one object a step at twice the velocity one fixed table of samples sets, the
 * shared drift added once; choosing that table is all this entry does. LIVE-OUT: memory. */

import { flyAlongHeadingAtDoubleVelocity } from "./flyAlongHeadingAtDoubleVelocity.js";

const VELOCITY_TABLE = 0x5e00;

export function loc_58b6(m) {
  flyAlongHeadingAtDoubleVelocity(m, VELOCITY_TABLE);
}
