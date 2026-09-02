// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

// Fetch a 4-byte record through the BC cursor: the 0xff terminator leaves carry set with BC parked;
// otherwise unpack the two little-endian words into HL and DE, step BC past all four, and clear carry.
export function loc_1856(m, bc = m.regs.bc) {
  const first = m.mem8[bc];
  if (first === 0xff) {
    return [(m.regs.a = first), (m.regs.fC = true)];
  }
  const h = m.mem8[u16(bc + 1)];
  const e = m.mem8[u16(bc + 2)];
  const d = m.mem8[u16(bc + 3)];
  return [(m.regs.hl = (h << 8) | first), (m.regs.de = (d << 8) | e), (m.regs.bc = u16(bc + 4)), (m.regs.a = d), (m.regs.fC = false)];
}
