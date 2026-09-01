// SPDX-License-Identifier: GPL-3.0-only
import { loc_2067, loc_20f8, loc_20fc } from "./names.js";

// Select the active player's data pointer from bit0 of the flag cell.
export function loc_09ca(m) {
  return (m.regs.hl = (m.mem8[loc_2067] & 1) ? loc_20f8 : loc_20fc);
}
