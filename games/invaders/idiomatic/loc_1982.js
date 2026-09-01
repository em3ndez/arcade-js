// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS } from "./names.js";

// Store the accumulator into its work-RAM cell. Live-out: memory only; the seam completes the ret.
export function loc_1982(m, a = m.regs.a) {
  m.mem8[TASK_FLAGS] = a;
}
