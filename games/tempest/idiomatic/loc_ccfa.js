// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc7 } from "./loc_ccc7.js";

// Trampoline: register the fixed sound id 0xaf.
export function loc_ccfa(m, x = m.regs.x, y = m.regs.y) {
  loc_ccc7(m, 0xaf, x, y);
}
