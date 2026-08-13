// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSeatedSlotByEraIndex — run the arm the low three bits of the era index select out of a word table laid down inline just behind
 * this entry. The arm is entered as a transfer with no place parked for it to come back to, so it returns past
 * this entry and nothing here runs after it. Three bits admit eight arms, each read through the arithmetic the
 * machine itself uses, so an index never seen is carried out, not assumed away. LIVE-OUT: memory, and the arm's. */

import { ERA_INDEX, ERA_SLOT_DISPATCH_TABLE } from "./names.js";

const ARM_MASK = 0x07;
const ENTRY_WIDTH = 2;

export function dispatchSeatedSlotByEraIndex(m) {
  const arm = m.mem16[ERA_SLOT_DISPATCH_TABLE + ENTRY_WIDTH * (m.mem8[ERA_INDEX] & ARM_MASK)];
  return m.call(arm);
}
