// SPDX-License-Identifier: GPL-3.0-only
/** loc_5994 — hand back the doubled component pair an object's OWN heading calls for, at the pace
 * one fixed table of samples sets. Choosing that table is all this entry adds; the heading comes
 * off the record, and any pointer the caller was holding is discarded. LIVE-OUT: the pair. */

import { doubledVelocityForHeading } from "./doubledVelocityForHeading.js";
import { VELOCITY_TABLE_5C00 } from "./names.js";

const VELOCITY_TABLE = VELOCITY_TABLE_5C00;
const HEADING_CELL = 2;

export function loc_5994(m, object = m.regs.ix) {
  const { mem8 } = m;
  return doubledVelocityForHeading(m, VELOCITY_TABLE, mem8[object + HEADING_CELL]);
}
