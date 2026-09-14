// SPDX-License-Identifier: GPL-3.0-only
import { emitByteBitsAsDigits } from "./emitByteBitsAsDigits.js";

// Emit the eight-bit digit run with the index preset to the fixed slot.
export function loc_dd29(m, y = m.regs.y, a = m.regs.a) {
  return emitByteBitsAsDigits(m, y, a, 0xf8);
}
