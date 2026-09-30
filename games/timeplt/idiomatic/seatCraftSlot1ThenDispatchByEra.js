// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot1ThenDispatchByEra — hand slot 1's craft record + entry cursors to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT1, CRAFT_RECORD_SLOT1 } from "./names.js";


export function seatCraftSlot1ThenDispatchByEra(m) {
  return dispatchSeatedSlotByEraIndex(m, CRAFT_RECORD_SLOT1, CRAFT_ENTRY_SLOT1);
}
