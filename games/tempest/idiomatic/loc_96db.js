// SPDX-License-Identifier: GPL-3.0-only
import { loc_2c, loc_160 } from "./names.js";
import { u16 } from "../../../core/int.js";

// Resolve a list entry to an absolute coordinate: read the byte at the pointer indexed by
// the entry offset, then add the base value. Returns the sum in A.
export function loc_96db(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const ptr = mem16[loc_2c];
  const value = mem8[u16(ptr + y)];
  return (m.regs.a = (value + mem8[loc_160]) & 0xff);
}
