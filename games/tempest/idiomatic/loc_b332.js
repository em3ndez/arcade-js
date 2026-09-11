// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_74, loc_75, loc_415, loc_16e, loc_2000, loc_cec4, loc_ce9e, loc_ce68 } from "./names.js";

// If the source byte differs from the checkpoint byte, publish it and return carry set. Otherwise copy a
// two-byte record (selected by a mode flag) through the working pointer, reload that pointer from another
// record, and return carry clear.
export function loc_b332(m) {
  const { mem8 } = m;
  const src = mem8[loc_cec4];
  if (src !== mem8[loc_2000]) {
    mem8[loc_2000] = src;
    return true;  // carry set (the caller branches on this)
  }
  const x = mem8[loc_415] !== 0 ? 0x08 : 0x02;   // mode flag picks the record slot
  const ptr = mem8[loc_74] | (mem8[loc_75] << 8);
  mem8[loc_16e] = 0;
  mem8[u16(ptr)] = mem8[u16(loc_ce9e + x)];
  mem8[u16(ptr + 1)] = mem8[u16(loc_ce9e + x + 1)];
  mem8[loc_74] = mem8[u16(loc_ce68 + x)];
  mem8[loc_75] = mem8[u16(loc_ce68 + x + 1)];
  return false;  // carry clear (the copy path ran)
}
