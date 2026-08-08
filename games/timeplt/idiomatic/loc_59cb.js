// SPDX-License-Identifier: GPL-3.0-only
/** loc_59cb — hand back the doubled component pair a heading handed straight in calls for, at the
 * pace one fixed table of samples sets; choosing that table is all this entry does. LIVE-OUT: the pair. */

import { doubledVelocityForHeading } from "./doubledVelocityForHeading.js";

const VELOCITY_TABLE = 0x5c00;

export function loc_59cb(m) {
  doubledVelocityForHeading(m, VELOCITY_TABLE);
}
