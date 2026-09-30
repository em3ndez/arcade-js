// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot2ThenDispatchByEra — hand slot 2's craft record + entry cursors to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT2, CRAFT_RECORD_SLOT2 } from "./names.js";


export function seatCraftSlot2ThenDispatchByEra(m) {
  return dispatchSeatedSlotByEraIndex(m, CRAFT_RECORD_SLOT2, CRAFT_ENTRY_SLOT2);
}
