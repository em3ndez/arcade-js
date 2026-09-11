// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_29, loc_2c } from "./names.js";

// Convert the binary byte in A to packed BCD (double-dabble): 8 passes each shift
// the top bit out of the source and double the BCD accumulator, folding that bit in.

// Decimal-mode double-of-(x + carry): returns the low byte of (x + x + carryIn) in BCD.
function bcdDouble(x, carryIn) {
  let al = (x & 0x0f) + (x & 0x0f) + carryIn;
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
  let sum = (x & 0xf0) + (x & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;
  return sum & 0xff;
}

export function loc_aaf5(m, a = m.regs.a) {
  const { mem8 } = m;
  let shifted = a & 0xff; // source byte, shifted left one bit per pass
  let bcd = 0x00;         // BCD accumulator
  for (let i = 0; i < 8; i++) {
    const carry = (shifted >> 7) & 1;
    shifted = u8(shifted << 1);
    bcd = bcdDouble(bcd, carry);
  }
  mem8[loc_29] = bcd;
  mem8[loc_2c] = bcd;
  return (m.regs.a = bcd);
}
