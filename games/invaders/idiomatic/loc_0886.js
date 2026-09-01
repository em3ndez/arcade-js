// SPDX-License-Identifier: GPL-3.0-only
import { loc_2067 } from "./names.js";

// Build the record pointer HL from its high-byte cell with a fixed low byte.
export function loc_0886(m) {
  return (m.regs.hl = (m.mem8[loc_2067] << 8) | 0xfc);
}
