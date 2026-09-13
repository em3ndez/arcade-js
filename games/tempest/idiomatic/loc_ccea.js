// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: register the fixed sound id 0x2f through the enable gate, forwarding the slot index x.
export function loc_ccea(m, x = m.regs.x) {
  loc_ccc3(m, 0x2f, x);
}
