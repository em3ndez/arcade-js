// SPDX-License-Identifier: GPL-3.0-only
import { loc_dd2b } from "./loc_dd2b.js";

// Emit the eight-bit digit run with the index preset to the fixed slot.
export function loc_dd29(m, y = m.regs.y, a = m.regs.a) {
  return loc_dd2b(m, y, a, 0xf8);
}
