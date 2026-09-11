// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_a9, loc_61, loc_62, loc_63, loc_64, loc_6a, loc_6b, loc_6c, loc_6d, loc_74, loc_75 } from "./names.js";

// Store two 16-bit differences through a pointer at a running cursor: each
// difference's low byte goes out raw and its high byte is kept to 5 bits, with
// the pattern 0xa0 forced into the second high byte. The cursor advances four.
export function loc_c73c(m) {
  const { mem8 } = m;
  let y = mem8[loc_a9];
  const base = mem8[loc_74] | (mem8[loc_75] << 8);

  const d1 = u16((mem8[loc_63] | (mem8[loc_64] << 8)) - (mem8[loc_6c] | (mem8[loc_6d] << 8)));
  mem8[u16(base + y)] = d1; y = u8(y + 1);
  mem8[u16(base + y)] = (d1 >> 8) & 0x1f; y = u8(y + 1);

  const d2 = u16((mem8[loc_61] | (mem8[loc_62] << 8)) - (mem8[loc_6a] | (mem8[loc_6b] << 8)));
  mem8[u16(base + y)] = d2; y = u8(y + 1);
  mem8[u16(base + y)] = ((d2 >> 8) & 0x1f) | 0xa0; y = u8(y + 1);

  mem8[loc_a9] = y;
}
