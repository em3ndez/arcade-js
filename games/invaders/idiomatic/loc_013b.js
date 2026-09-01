// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

// Advance the sprite pointer to its second bank (DE += 0x30). Live-out: DE; the seam completes the ret.
export function loc_013b(m, de = m.regs.de) {
  return (m.regs.de = u16(de + 0x30));
}
