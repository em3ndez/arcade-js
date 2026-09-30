// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot4ThenDispatchByEra — hand slot 4's craft record + entry cursors to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT4, CRAFT_RECORD_SLOT4 } from "./names.js";


export function seatCraftSlot4ThenDispatchByEra(m) {
  return dispatchSeatedSlotByEraIndex(m, CRAFT_RECORD_SLOT4, CRAFT_ENTRY_SLOT4);
}
