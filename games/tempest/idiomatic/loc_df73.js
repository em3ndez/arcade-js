// SPDX-License-Identifier: GPL-3.0-only
import { loc_73 } from "./names.js";
import { loc_df75 } from "./loc_df75.js";

// Stash the index byte, then scale the two coordinates into the vector work pair.
export function loc_df73(m, y = m.regs.y, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_73] = y;
  return loc_df75(m, a, x);
}
