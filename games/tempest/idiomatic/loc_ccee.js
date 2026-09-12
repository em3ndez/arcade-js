// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: register the fixed sound id 0x6f through the enable gate.
export function loc_ccee(m, x = m.regs.x, y = m.regs.y) {
  loc_ccc3(m, 0x6f, x, y);
}
