// SPDX-License-Identifier: GPL-3.0-only
/** serviceFixedSlotInEra1 — service one fixed object slot, and only while the era index holds one particular
 * value; every other era leaves without touching a thing. The slot's record and the sprite entry
 * that goes with it are constants here, so this entry is a guard plus the choice of that one
 * pair. What servicing amounts to is not decided here. LIVE-OUT: memory. */

import { serviceSlotByHeadByte } from "./serviceSlotByHeadByte.js";
import { ERA_INDEX } from "./names.js";

const SERVICED_ERA = 1;
const SLOT_RECORD = 0xa8e0;
const SPRITE_ENTRY = 0xaa2c;

export function serviceFixedSlotInEra1(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA) return;
  regs.ix = SLOT_RECORD;
  regs.iy = SPRITE_ENTRY;
  serviceSlotByHeadByte(m);
}
