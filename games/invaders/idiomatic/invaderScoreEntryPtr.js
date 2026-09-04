// SPDX-License-Identifier: GPL-3.0-only
import { loc_1da0 } from "./names.js";

// Clamp-index the accumulator into one of three consecutive table slots.
export function invaderScoreEntryPtr(m, a = m.regs.a) {
  return (m.regs.hl = loc_1da0 + (a >= 0x04 ? 2 : a >= 0x02 ? 1 : 0));
}
