// SPDX-License-Identifier: GPL-3.0-only
import { loc_2048 } from "./names.js";

// Store the 16-bit pointer into its work-RAM cell. Live-out: memory only; the seam completes the ret.
export function loc_067e(m, hl = m.regs.hl) {
  m.mem16[loc_2048] = hl;
}
