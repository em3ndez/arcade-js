// SPDX-License-Identifier: GPL-3.0-only
import { loc_af77 } from "./loc_af77.js";

// Clamp the incoming byte to a max of 0x63, then pack-and-emit it.
export function loc_af71(m, a = m.regs.a) {
  return loc_af77(m, Math.min(a, 0x63));
}
