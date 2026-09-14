// SPDX-License-Identifier: GPL-3.0-only
import { emitByteBitsAsDigitsAtF8 } from "./emitByteBitsAsDigitsAtF8.js";

// Emit the digit run with a fixed value byte.
export function loc_dd27(m, y = m.regs.y) {
  return emitByteBitsAsDigitsAtF8(m, y, 0xd0);
}
