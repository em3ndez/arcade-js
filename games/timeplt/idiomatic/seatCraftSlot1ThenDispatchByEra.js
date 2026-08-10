// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot1ThenDispatchByEra — seat slot 1's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT1, CRAFT_RECORD_SLOT1 } from "./names.js";


export function seatCraftSlot1ThenDispatchByEra(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT1;
  regs.iy = CRAFT_ENTRY_SLOT1;
  return dispatchSeatedSlotByEraIndex(m);
}
