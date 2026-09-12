// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_156, loc_58, loc_56, loc_57, loc_b5, loc_d575 } from "./names.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_dfb1 } from "./loc_dfb1.js";

// When the flag is set, seat it and emit a cleared record; always fold a table into a checksum byte.
export function loc_aeca(m) {
  const { mem8 } = m;
  const flag = mem8[loc_156];
  if (flag !== 0) {
    mem8[loc_58] = flag;
    loc_ab14(m, 0x34);
    mem8[loc_56] = 0x00;
    mem8[loc_57] = 0x00;
    loc_dfb1(m, 0x56, 0x03);
  }
  let acc = 0x85;
  let carry = 0;
  for (let y = 0x10; y >= 0; y--) {
    const sum = acc + mem8[u16(loc_d575 + y)] + carry;
    acc = sum & 0xff;
    carry = sum > 0xff ? 1 : 0;
  }
  mem8[loc_b5] = acc;
  return acc;
}
