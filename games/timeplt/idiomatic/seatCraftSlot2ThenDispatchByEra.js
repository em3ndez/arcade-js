// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot2ThenDispatchByEra — seat slot 2's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT2, CRAFT_RECORD_SLOT2 } from "./names.js";


export function seatCraftSlot2ThenDispatchByEra(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT2;
  regs.iy = CRAFT_ENTRY_SLOT2;
  return dispatchSeatedSlotByEraIndex(m);
}
