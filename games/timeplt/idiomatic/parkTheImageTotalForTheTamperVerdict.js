// SPDX-License-Identifier: GPL-3.0-only
/** parkTheImageTotalForTheTamperVerdict — park the running total in the register the verdict arm reads from, then hand on by transfer. LIVE-OUT: memory and registers. */

import { loc_5303 } from "./loc_5303.js";

export function parkTheImageTotalForTheTamperVerdict(m) {
  const { regs } = m;
  regs.b = regs.a;
  return loc_5303(m);
}
