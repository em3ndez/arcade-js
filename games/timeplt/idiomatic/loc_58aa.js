// SPDX-License-Identifier: GPL-3.0-only
/** loc_58aa — fly one object a double step at the pace one fixed table of velocity samples sets. Choosing the
 * table and the mover is the whole of this entry, and a pointer the caller held is discarded. LIVE-OUT: memory. */

import { flyAlongHeadingAtDoubleVelocity } from "./flyAlongHeadingAtDoubleVelocity.js";

const VELOCITY_TABLE = 0x59d7;

export function loc_58aa(m) {
  flyAlongHeadingAtDoubleVelocity(m, VELOCITY_TABLE);
}
