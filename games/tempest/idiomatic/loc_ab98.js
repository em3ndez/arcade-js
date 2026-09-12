// SPDX-License-Identifier: GPL-3.0-only
import { loc_35, loc_2a, loc_2b } from "./names.js";
import { loc_ab3b } from "./loc_ab3b.js";

// Seat the two scratch inputs and clear the flag byte, then run the shared record builder.
export function loc_ab98(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  mem8[loc_35] = x;
  mem8[loc_2a] = a;
  mem8[loc_2b] = 0x00;
  return loc_ab3b(m);
}
