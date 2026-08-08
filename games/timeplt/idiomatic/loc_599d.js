// SPDX-License-Identifier: GPL-3.0-only
/** loc_599d — take an object's heading from its own record and hand back the doubled component
 * pair the table the caller is already holding gives for it. That pointer is carried through
 * rather than replaced, so the pace stays the caller's choice. LIVE-OUT: the pair. */

import { doubledVelocityForHeading } from "./doubledVelocityForHeading.js";

const HEADING_CELL = 2;

export function loc_599d(m) {
  const { regs } = m;
  doubledVelocityForHeading(m, regs.hl, m.mem8[regs.ix + HEADING_CELL]);
}
