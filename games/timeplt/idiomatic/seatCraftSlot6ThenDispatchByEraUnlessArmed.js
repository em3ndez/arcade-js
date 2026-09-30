// SPDX-License-Identifier: GPL-3.0-only
/** seatCraftSlot6ThenDispatchByEraUnlessArmed — unless the Mother-Ship is up, hand slot 6's craft record + entry cursors to the era arm. LIVE-OUT: memory. */

import { dispatchSeatedSlotByEraIndex } from "./dispatchSeatedSlotByEraIndex.js";
import { CRAFT_ENTRY_SLOT6, CRAFT_RECORD_SLOT6, MOTHER_SHIP_ARMED } from "./names.js";


export function seatCraftSlot6ThenDispatchByEraUnlessArmed(m) {
  if (m.mem8[MOTHER_SHIP_ARMED] !== 0) return;
  return dispatchSeatedSlotByEraIndex(m, CRAFT_RECORD_SLOT6, CRAFT_ENTRY_SLOT6);
}
