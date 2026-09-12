// SPDX-License-Identifier: GPL-3.0-only
import { loc_201 } from "./names.js";
import { loc_a352 } from "./loc_a34b.js";

// Insert an object tagged 5 through the shared tail, then step the pending counter down one.
export function loc_a33a(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  loc_a352(m, 0x05, x, y);
  mem8[loc_201] = mem8[loc_201] - 1;
}
