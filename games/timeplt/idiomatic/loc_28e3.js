// SPDX-License-Identifier: GPL-3.0-only
/** loc_28e3 — seat slot 4's craft record + entry cursors, then transfer to the era arm. LIVE-OUT: memory. */

import { loc_290e } from "./loc_290e.js";
import { CRAFT_ENTRY_SLOT4, CRAFT_RECORD_SLOT4 } from "./names.js";


export function loc_28e3(m) {
  m.regs.ix = CRAFT_RECORD_SLOT4;
  m.regs.iy = CRAFT_ENTRY_SLOT4;
  return loc_290e(m);
}
