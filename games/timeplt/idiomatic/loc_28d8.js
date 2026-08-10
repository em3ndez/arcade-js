// SPDX-License-Identifier: GPL-3.0-only
/** loc_28d8 — seat slot 3's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { loc_290e } from "./loc_290e.js";
import { CRAFT_ENTRY_SLOT3, CRAFT_RECORD_SLOT3 } from "./names.js";


export function loc_28d8(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT3;
  regs.iy = CRAFT_ENTRY_SLOT3;
  return loc_290e(m);
}
