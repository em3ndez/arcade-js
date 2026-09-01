// SPDX-License-Identifier: GPL-3.0-only
import { activePlayerPageBase } from "./activePlayerPageBase.js";

// Read the byte at the top of the active player's record page. Live-out: HL, A.
export function readActivePlayerPageTopByte(m) {
  const ptr = activePlayerPageBase(m) | 0xff;
  return [(m.regs.hl = ptr), (m.regs.a = m.mem8[ptr])];
}
