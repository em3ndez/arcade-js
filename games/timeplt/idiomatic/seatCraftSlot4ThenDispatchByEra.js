// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot4ThenDispatchByEra — seat slot 4's craft record + entry cursors, then transfer to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT4, CRAFT_RECORD_SLOT4 } from "./names.js";


export function seatCraftSlot4ThenDispatchByEra(m) {
  m.regs.ix = CRAFT_RECORD_SLOT4;
  m.regs.iy = CRAFT_ENTRY_SLOT4;
  return dispatchSeatedSlotByEraIndex(m);
}
