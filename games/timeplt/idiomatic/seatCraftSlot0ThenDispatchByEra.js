// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot0ThenDispatchByEra — hand slot 0's craft record + entry cursors to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT0, CRAFT_RECORD_SLOT0 } from "./names.js";


export function seatCraftSlot0ThenDispatchByEra(m) {
  return dispatchSeatedSlotByEraIndex(m, CRAFT_RECORD_SLOT0, CRAFT_ENTRY_SLOT0);
}
