// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_29, COORD_LIST_PTR_LO } from "./names.js";

/**
 * packBinaryToBcd — convert a binary byte to packed BCD by double-dabble. ROM 0xaaf5.
 *
 * Role in the machine: display quantities (coordinates and the like) are kept in packed binary-coded-decimal
 * so they can be rendered digit by digit and added with the 6502's decimal mode. This routine takes a plain
 * binary byte in A and produces its two-digit packed-BCD equivalent, publishing it where the coordinate/
 * print path reads it.
 *
 * Behaviour: classic double-dabble over eight passes. Each pass shifts the top bit out of the source byte
 * and doubles the BCD accumulator, folding that shifted-out bit into the low end. The doubling runs in
 * decimal (bcdDouble) so every nibble stays a valid 0..9 digit, applying the 6502 decimal-adjust
 * corrections (+6 on a nibble past 9, +0x60 on the byte past 0x9x) as it goes.
 *
 * Live-out: the packed result written to loc_29 and loc_2c (COORD_LIST_PTR_LO), and register A. Grounding:
 * [seen].
 */

// Decimal-mode double-of-(x + carry): returns the low byte of (x + x + carryIn) in BCD.
function bcdDouble(x, carryIn) {
  let al = (x & 0x0f) + (x & 0x0f) + carryIn;
  if (al > 9) al = ((al + 6) & 0x0f) + 0x10;
  let sum = (x & 0xf0) + (x & 0xf0) + al;
  if (sum >= 0xa0) sum += 0x60;
  return sum & 0xff;
}

export function packBinaryToBcd(m, a = m.regs.a) {
  const { mem8 } = m;
  let shifted = a & 0xff; // source byte, shifted left one bit per pass
  let bcd = 0x00;         // BCD accumulator
  for (let i = 0; i < 8; i++) {
    const carry = (shifted >> 7) & 1;
    shifted = u8(shifted << 1);
    bcd = bcdDouble(bcd, carry);
  }
  mem8[loc_29] = bcd;
  mem8[COORD_LIST_PTR_LO] = bcd;
  return (m.regs.a = bcd);
}
