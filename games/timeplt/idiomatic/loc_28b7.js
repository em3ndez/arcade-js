// SPDX-License-Identifier: GPL-3.0-only
/** loc_28b7 — seat slot 0's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { loc_290e } from "./loc_290e.js";
import { CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0 } from "./names.js";


export function loc_28b7(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT0;
  regs.iy = CRAFT_ENTRY_SLOT0;
  return loc_290e(m);
}
