// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

// Scan 23 bytes upward from `ptr` for the first nonzero; return true (fleet edge reached) on a hit,
// false when all 23 are zero. Sets carry to match -- the caller reads it via rnc. The "found" sentinel
// (set-carry) is inlined so the result is a real boolean, not the seam's undefined ret.
export function loc_15c5(m, ptr = m.regs.hl) {
  for (let i = 0; i < 0x17; i++) {
    if (m.mem8[u16(ptr + i)] !== 0) return (m.regs.fC = true);
  }
  return (m.regs.fC = false);
}
