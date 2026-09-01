// SPDX-License-Identifier: GPL-3.0-only
import { loc_2067, loc_20e7 } from "./names.js";

// Point HL one past the base cell when bit0 of the select byte is set. Live-out: HL; seam completes the ret.
export function loc_18e7(m) {
  return (m.regs.hl = loc_20e7 + (m.mem8[loc_2067] & 1));
}
