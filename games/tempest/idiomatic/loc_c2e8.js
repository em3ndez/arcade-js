// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_112, loc_bc7c, loc_60ca } from "./names.js";

// Reduce an input byte (values >= 0x62 are swapped for a masked random byte), split it
// into a /16 quotient and remainder, look the remainder up in a table, store that byte,
// and hand back the table value in the high nibble with the low nibble filled in.
export function loc_c2e8(m, a = m.regs.a) {
  const { mem8 } = m;
  let value = a & 0xff;
  if (value >= 0x62) value = mem8[loc_60ca] & 0x5f;
  const quotient = value >> 4;
  const remainder = value & 0x0f;
  const entry = mem8[u16(loc_bc7c + remainder)];
  mem8[loc_112] = entry;
  const result = u8(entry << 4) | 0x0f;
  return [(m.regs.a = result), (m.regs.x = quotient), (m.regs.y = remainder)];
}
