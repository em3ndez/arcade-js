// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

// Build the record pointer HL from its high-byte cell with a fixed low byte.
export function activeFieldRecordPointer(m) {
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] << 8) | 0xfc);
}
