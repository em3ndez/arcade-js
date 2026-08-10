// SPDX-License-Identifier: GPL-3.0-only
/** loc_28cd — seat slot 2's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { loc_290e } from "./loc_290e.js";
import { CRAFT_ENTRY_SLOT2, CRAFT_RECORD_SLOT2 } from "./names.js";


export function loc_28cd(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT2;
  regs.iy = CRAFT_ENTRY_SLOT2;
  return loc_290e(m);
}
