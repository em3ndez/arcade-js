// SPDX-License-Identifier: GPL-3.0-only
/** loc_28c2 — seat slot 1's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { loc_290e } from "./loc_290e.js";
import { CRAFT_ENTRY_SLOT1, CRAFT_RECORD_SLOT1 } from "./names.js";


export function loc_28c2(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT1;
  regs.iy = CRAFT_ENTRY_SLOT1;
  return loc_290e(m);
}
