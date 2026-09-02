// SPDX-License-Identifier: GPL-3.0-only
import { loc_2003, loc_2064 } from "./names.js";
import { clearSpriteColumn } from "./clearSpriteColumn.js";
import { retirePrize } from "./retirePrize.js";

// Tick the prize despawn timer; while it still counts, do nothing. On expiry, clear the prize's
// screen column then deactivate the prize; value-out A, live-out HL.
export function loc_1538(m) {
  m.mem8[loc_2003] = m.mem8[loc_2003] - 1;
  if (m.mem8[loc_2003] !== 0) return;
  // seat the column start, clear 16 rows, then run the deactivation tail
  return (m.regs.hl = m.mem16[loc_2064]), clearSpriteColumn(m, 0x10), retirePrize(m);
}
