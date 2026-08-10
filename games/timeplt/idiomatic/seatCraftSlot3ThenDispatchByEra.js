// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot3ThenDispatchByEra — seat slot 3's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT3, CRAFT_RECORD_SLOT3 } from "./names.js";


export function seatCraftSlot3ThenDispatchByEra(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT3;
  regs.iy = CRAFT_ENTRY_SLOT3;
  return dispatchSeatedSlotByEraIndex(m);
}
