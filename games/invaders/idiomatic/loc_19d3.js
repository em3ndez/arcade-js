// SPDX-License-Identifier: GPL-3.0-only
import { loc_20e9 } from "./names.js";

// Store the accumulator into its work-RAM cell (a shared tail). Live-out: memory; the seam completes the ret.
export function loc_19d3(m, a = m.regs.a) {
  m.mem8[loc_20e9] = a;
}
