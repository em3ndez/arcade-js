// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot0ThenDispatchByEra — seat slot 0's craft record + entry cursors, then run the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0 } from "./names.js";


export function seatCraftSlot0ThenDispatchByEra(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD_SLOT0;
  regs.iy = CRAFT_ENTRY_SLOT0;
  return dispatchSeatedSlotByEraIndex(m);
}
