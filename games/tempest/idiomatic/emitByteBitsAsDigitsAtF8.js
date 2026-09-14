// SPDX-License-Identifier: GPL-3.0-only
import { emitByteBitsAsDigits } from "./emitByteBitsAsDigits.js";

// Emit the eight-bit digit run with the index preset to the fixed slot.
export function emitByteBitsAsDigitsAtF8(m, y = m.regs.y, a = m.regs.a) {
  return emitByteBitsAsDigits(m, y, a, 0xf8);
}
