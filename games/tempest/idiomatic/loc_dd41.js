// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_29, loc_2a, loc_31, loc_37, loc_38, loc_3b, loc_3c, loc_56, loc_57, loc_58,
  loc_409, loc_40a, loc_40b, loc_40c, loc_40d, loc_40f, loc_410, loc_412, loc_413,
  loc_608d, loc_6095, loc_6096,
} from "./names.js";
import { loc_dce6 } from "./loc_dce6.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_dfb1 } from "./loc_dfb1.js";
import { loc_df75 } from "./loc_df75.js";

// Packed-decimal add of two little-endian input pairs -- the first also doubled --
// forced to a minimum of one, then five passes of binary-to-BCD double-dabble over the
// three-byte source the running pointer walks, emitting each pass's converted digits.
function addDecimal(a, v, carryIn) {
  let al = (a & 0x0f) + (v & 0x0f) + (carryIn ? 1 : 0);
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;
  return [sum & 0xff, sum > 0xff];
}

export function loc_dd41(m) {
  const { mem8, mem16 } = m;
  const carryHi = mem8[loc_40f] & 0x80 ? 1 : 0;
  mem8[loc_29] = mem8[loc_40f] << 1;
  mem8[loc_2a] = (mem8[loc_410] << 1) | carryHi;
  const lo = mem8[loc_40c] + mem8[loc_29];
  mem8[loc_6095] = lo;
  mem8[loc_29] = lo;
  const hi = mem8[loc_40d] + mem8[loc_2a] + (lo > 0xff ? 1 : 0);
  mem8[loc_6096] = hi;
  if (((hi & 0xff) | mem8[loc_29]) === 0) mem8[loc_6095] = 0x01;
  mem8[loc_608d] = mem8[loc_409];
  const [q, , r] = loc_dce6(m, mem8[loc_40a], mem8[loc_40b]);
  mem8[loc_412] = q;
  mem8[loc_413] = r;
  loc_df39(m, 0x3d, 0xce);
  mem8[loc_3b] = 0x06;
  mem8[loc_3c] = 0x04;
  mem8[loc_37] = 0x04;
  do {
    mem8[loc_31] = 0x00;
    mem8[loc_31 + 1] = 0x00;
    mem8[loc_31 + 2] = 0x00;
    mem8[loc_31 + 3] = 0x00;
    mem8[loc_56] = mem8[mem16[loc_3b]];
    mem8[loc_3b] = mem8[loc_3b] + 1;
    mem8[loc_57] = mem8[mem16[loc_3b]];
    mem8[loc_3b] = mem8[loc_3b] + 1;
    mem8[loc_58] = mem8[mem16[loc_3b]];
    mem8[loc_3b] = mem8[loc_3b] + 1;
    let carry = false;
    mem8[loc_38] = 0x17;
    do {
      let shifted = (mem8[loc_56] << 1) | (carry ? 1 : 0);
      carry = (mem8[loc_56] & 0x80) !== 0;
      mem8[loc_56] = shifted;
      shifted = (mem8[loc_57] << 1) | (carry ? 1 : 0);
      carry = (mem8[loc_57] & 0x80) !== 0;
      mem8[loc_57] = shifted;
      shifted = (mem8[loc_58] << 1) | (carry ? 1 : 0);
      carry = (mem8[loc_58] & 0x80) !== 0;
      mem8[loc_58] = shifted;
      for (let d = 0; d <= 3; d++) {
        const [sum, out] = addDecimal(mem8[loc_31 + d], mem8[loc_31 + d], carry);
        mem8[loc_31 + d] = sum;
        carry = out;
      }
      mem8[loc_38] = mem8[loc_38] - 1;
    } while ((mem8[loc_38] & 0x80) === 0);
    loc_dfb1(m, 0x31, 0x04);
    loc_df75(m, 0xd0, 0xf8);
    mem8[loc_37] = mem8[loc_37] - 1;
  } while ((mem8[loc_37] & 0x80) === 0);
}
