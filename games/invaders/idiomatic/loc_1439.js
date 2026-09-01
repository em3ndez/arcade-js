// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

// Copy B source bytes into a vertical column, dropping the destination one screen row per byte.
export function loc_1439(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b) {
  const rows = b || 256; // a count of 0 wraps to a full 256-byte pass
  let src = de;
  let dst = hl;
  for (let i = 0; i < rows; i++) {
    m.mem8[dst] = m.mem8[src];
    src = u16(src + 1);
    dst = u16(dst + 0x20);
  }
  return (m.regs.hl = dst);
}
