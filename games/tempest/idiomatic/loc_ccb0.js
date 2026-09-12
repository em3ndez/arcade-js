// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: gate-register the fixed sound id 0x5f, carrying the caller's X/Y.
export function loc_ccb0(m, x = m.regs.x, y = m.regs.y) {
  return loc_ccc3(m, 0x5f, x, y);
}
