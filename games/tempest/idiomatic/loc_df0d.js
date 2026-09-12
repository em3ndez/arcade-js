// SPDX-License-Identifier: GPL-3.0-only
import { loc_74 } from "./names.js";
import { loc_df53 } from "./loc_df53.js";
import { loc_dfac } from "./loc_df92.js";

// Emit the header pair, then store a fixed body byte at the cursor origin before running
// the shared record tail.
export function loc_df0d(m) {
  loc_df53(m);
  return loc_df12(m, 0x20);
}

// Store one body byte at the cursor origin, then continue the shared record tail.
export function loc_df12(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  mem8[mem16[loc_74]] = a;   // store at cursor + 0
  return loc_dfac(m, a, 0);
}
