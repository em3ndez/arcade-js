// SPDX-License-Identifier: GPL-3.0-only
import { PRIZE_ACTIVE } from "./names.js";
import { loc_19dc } from "./loc_19dc.js";

// Clear the prize-active flag, then mask bit 3 off the sound shadow; value-out A.
export function deactivatePrize(m) {
  m.mem8[PRIZE_ACTIVE] = 0;
  return loc_19dc(m, 0xf7);
}
