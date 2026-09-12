// SPDX-License-Identifier: GPL-3.0-only
import { loc_29 } from "./names.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_dfb1 } from "./loc_dfb1.js";

// Stash the accumulator, scale the two coordinates into the vector work pair, then
// emit that one stashed byte as a single-entry vector run.
export function loc_d8a9(m, a = m.regs.a, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_29] = a;
  loc_df75(m, y, x);
  loc_dfb1(m, loc_29, 0x01);
}
