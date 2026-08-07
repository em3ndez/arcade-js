// SPDX-License-Identifier: GPL-3.0-only
/** retireSlotIntoSharedCooldown — take a slot out of play and, in the same breath, stock the fifteenth byte of its record
 * from one fixed address, so it goes out holding that shared value rather than a zero and every slot retired here gets
 * the same one. Which slot is the caller's: both bases arrive in the index registers. Nothing here reads the stocked
 * byte back, so how long it lasts is not settled here. LIVE-OUT: memory, plus the stocked value, in the accumulator. */

import { retireSlot } from "./retireSlot.js";

const SHARED_SOURCE = 0xa8f6;
const RECORD_BYTE = 14;

export function retireSlotIntoSharedCooldown(m) {
  const { regs, mem8 } = m;
  retireSlot(m);
  regs.a = mem8[SHARED_SOURCE];
  mem8[regs.ix + RECORD_BYTE] = regs.a;
}
