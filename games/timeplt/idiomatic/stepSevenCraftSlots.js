// SPDX-License-Identifier: GPL-3.0-only
/** stepSevenCraftSlots — work seven fixed object slots in one fixed order, each through the entry that seats
 * its own pair of cursors. The order is the whole of what this file decides; nothing here reads or
 * writes a slot itself. The last two stand down while the mother-ship cell is set.
 *
 * ★ THE RESUME POINT IS A DEBT. Each entry below hands over to an arm that lifts one value off the
 * stack before it finishes, so one is laid down for it first — except for the two that stand down,
 * which reach no arm and lift nothing, so nothing is laid down for them either.
 * LIVE-OUT: memory, and whatever the last slot worked leaves behind. */

import { MOTHER_SHIP_ARMED } from "./names.js";
import { seatCraftSlot0ThenDispatchByEra } from "./seatCraftSlot0ThenDispatchByEra.js";
import { seatCraftSlot1ThenDispatchByEra } from "./seatCraftSlot1ThenDispatchByEra.js";
import { seatCraftSlot2ThenDispatchByEra } from "./seatCraftSlot2ThenDispatchByEra.js";
import { seatCraftSlot3ThenDispatchByEra } from "./seatCraftSlot3ThenDispatchByEra.js";
import { seatCraftSlot4ThenDispatchByEra } from "./seatCraftSlot4ThenDispatchByEra.js";
import { seatMotherShipSlotThenDispatchByEraUnlessArmed } from "./seatMotherShipSlotThenDispatchByEraUnlessArmed.js";
import { seatCraftSlot6ThenDispatchByEraUnlessArmed } from "./seatCraftSlot6ThenDispatchByEraUnlessArmed.js";

const CHAIN = [
  [seatCraftSlot0ThenDispatchByEra, 0x28a4, false],
  [seatCraftSlot1ThenDispatchByEra, 0x28a7, false],
  [seatCraftSlot2ThenDispatchByEra, 0x28aa, false],
  [seatCraftSlot3ThenDispatchByEra, 0x28ad, false],
  [seatCraftSlot4ThenDispatchByEra, 0x28b0, false],
  [seatMotherShipSlotThenDispatchByEraUnlessArmed, 0x28b3, true],
  [seatCraftSlot6ThenDispatchByEraUnlessArmed, 0x28b6, true],
];

export function stepSevenCraftSlots(m) {
  for (const [workSlot, resumePoint, standsDown] of CHAIN) {
    if (!standsDown || m.mem8[MOTHER_SHIP_ARMED] === 0) m.push16(resumePoint);
    workSlot(m);
  }
}
