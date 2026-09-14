// SPDX-License-Identifier: GPL-3.0-only
import { emitByteAsBcdDigits } from "./emitByteAsBcdDigits.js";

// Clamp the incoming byte to a max of 0x63, then pack-and-emit it.
export function loc_af71(m, a = m.regs.a) {
  return emitByteAsBcdDigits(m, Math.min(a, 0x63));
}
