// SPDX-License-Identifier: GPL-3.0-only
import { loc_2067 } from "./names.js";

// Point HL at the top of the memory page named by the current-page byte. Live-out: HL.
export function loc_1611(m) {
  return (m.regs.hl = m.mem8[loc_2067] << 8);
}
