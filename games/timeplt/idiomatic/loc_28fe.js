// SPDX-License-Identifier: GPL-3.0-only
/** loc_28fe — unless the Mother-Ship is up, seat slot 6's craft record + entry cursors, then transfer to the era arm. LIVE-OUT: memory. */

import { loc_290e } from "./loc_290e.js";
import { CRAFT_ENTRY_SLOT6, CRAFT_RECORD_SLOT6, MOTHER_SHIP_ARMED } from "./names.js";


export function loc_28fe(m) {
  if (m.mem8[MOTHER_SHIP_ARMED] !== 0) return;
  m.regs.ix = CRAFT_RECORD_SLOT6;
  m.regs.iy = CRAFT_ENTRY_SLOT6;
  return loc_290e(m);
}
