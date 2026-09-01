// SPDX-License-Identifier: GPL-3.0-only
import { loc_20c1 } from "./names.js";

// Store the accumulator into its work-RAM cell. Live-out: memory only; the seam completes the ret.
export function loc_1982(m, a = m.regs.a) {
  m.mem8[loc_20c1] = a;
}
