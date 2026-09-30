// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot3ThenDispatchByEra — hand slot 3's craft record + entry cursors to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT3, CRAFT_RECORD_SLOT3 } from "./names.js";


export function seatCraftSlot3ThenDispatchByEra(m) {
  return dispatchSeatedSlotByEraIndex(m, CRAFT_RECORD_SLOT3, CRAFT_ENTRY_SLOT3);
}
