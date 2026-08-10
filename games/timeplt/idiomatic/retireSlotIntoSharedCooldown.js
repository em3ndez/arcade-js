// SPDX-License-Identifier: GPL-3.0-only
/** retireSlotIntoSharedCooldown — take the caller's slot out of play and stock its record byte (index 14) from the
 * shared ATTACKER_SPAWN_COOLDOWN_PERIOD, so every slot retired here goes out holding it. LIVE-OUT: memory + the value in A. */

import { retireSlot } from "./retireSlot.js";
import { ATTACKER_SPAWN_COOLDOWN_PERIOD } from "./names.js";

const RECORD_BYTE = 14;

export function retireSlotIntoSharedCooldown(m) {
  const { regs, mem8 } = m;
  retireSlot(m);
  regs.a = mem8[ATTACKER_SPAWN_COOLDOWN_PERIOD];
  mem8[regs.ix + RECORD_BYTE] = regs.a;
}
