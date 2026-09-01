// SPDX-License-Identifier: GPL-3.0-only
import { loc_2082 } from "./names.js";

// B is 2, or 3 when the select byte reads exactly 1. Live-out: B; seam completes the ret.
export function loc_18f1(m) {
  return (m.regs.b = m.mem8[loc_2082] === 1 ? 3 : 2);
}
