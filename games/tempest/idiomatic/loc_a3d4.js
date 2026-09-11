// SPDX-License-Identifier: GPL-3.0-only
import { loc_a3d6 } from "./loc_a3d6.js";
import { loc_2c } from "./names.js";

// Stash A into the scratch field, then insert a new object into the 8-slot table.
export function loc_a3d4(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2c] = a;
  return loc_a3d6(m, x, y);
}
