// SPDX-License-Identifier: GPL-3.0-only
/** loc_598e — hand back the doubled component pair an object's OWN heading calls for, at the pace
 * one fixed table of samples sets. Choosing that table is all this entry adds; the heading comes
 * off the record, and any pointer the caller was holding is discarded. LIVE-OUT: the pair. */

import { doubledVelocityForHeading } from "./doubledVelocityForHeading.js";

const VELOCITY_TABLE = 0x59d7;
const HEADING_CELL = 2;

export function loc_598e(m) {
  const { regs, mem8 } = m;
  doubledVelocityForHeading(m, VELOCITY_TABLE, mem8[regs.ix + HEADING_CELL]);
}
