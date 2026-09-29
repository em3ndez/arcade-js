// SPDX-License-Identifier: GPL-3.0-only
/** stepSevenCraftSlots — work seven fixed object slots in one fixed order, each through the entry that seats
 * its own pair of cursors. The order is the whole of what this file decides; nothing here reads or
 * writes a slot itself. The last two stand down while the mother-ship cell is set.
 * LIVE-OUT: memory, and whatever the last slot worked leaves behind. */

import { seatCraftSlot0ThenDispatchByEra } from "./seatCraftSlot0ThenDispatchByEra.js";
import { seatCraftSlot1ThenDispatchByEra } from "./seatCraftSlot1ThenDispatchByEra.js";
import { seatCraftSlot2ThenDispatchByEra } from "./seatCraftSlot2ThenDispatchByEra.js";
import { seatCraftSlot3ThenDispatchByEra } from "./seatCraftSlot3ThenDispatchByEra.js";
import { seatCraftSlot4ThenDispatchByEra } from "./seatCraftSlot4ThenDispatchByEra.js";
import { seatMotherShipSlotThenDispatchByEraUnlessArmed } from "./seatMotherShipSlotThenDispatchByEraUnlessArmed.js";
import { seatCraftSlot6ThenDispatchByEraUnlessArmed } from "./seatCraftSlot6ThenDispatchByEraUnlessArmed.js";

const CHAIN = [
  seatCraftSlot0ThenDispatchByEra,
  seatCraftSlot1ThenDispatchByEra,
  seatCraftSlot2ThenDispatchByEra,
  seatCraftSlot3ThenDispatchByEra,
  seatCraftSlot4ThenDispatchByEra,
  seatMotherShipSlotThenDispatchByEraUnlessArmed,
  seatCraftSlot6ThenDispatchByEraUnlessArmed,
];

export function stepSevenCraftSlots(m) {
  for (const workSlot of CHAIN) workSlot(m);
}
