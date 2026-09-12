// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: gate-register the fixed sound id 0x8f, carrying the caller's X/Y.
export function loc_ccbd(m, x = m.regs.x, y = m.regs.y) {
  loc_ccc3(m, 0x8f, x, y);
}
