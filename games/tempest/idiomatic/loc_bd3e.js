// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_57, loc_5b, loc_5f, loc_74, loc_75, loc_78, loc_79, loc_7a, loc_a0, loc_a9,
  loc_6040, loc_6060, loc_6070, loc_608c, loc_608e, loc_6094, loc_6095, loc_6096,
} from "./names.js";

// Append a (mantissa, exponent) pair to the table: small inputs use a fixed pair,
// otherwise drive the math coprocessor and normalize its result into an exponent.
export function loc_bd3e(m) {
  const { mem8 } = m;
  let a, y;
  if (mem8[loc_57] < 0x10) {
    a = 0x01;
    y = 0x00;
  } else {
    // 16-bit difference into the coprocessor operand registers.
    let t = mem8[loc_57] - mem8[loc_5f];
    const borrow = t < 0 ? 1 : 0;
    mem8[loc_6095] = t;
    mem8[loc_6096] = (0 - mem8[loc_5b] - borrow);
    mem8[loc_608c] = 0x18;
    mem8[loc_608e] = mem8[loc_a0];
    mem8[loc_6094] = mem8[loc_a0];         // issue the compute
    while ((mem8[loc_6040] & 0x80) !== 0) {}      // wait for done
    mem8[loc_79] = mem8[loc_6060];
    a = mem8[loc_7a] = mem8[loc_6070];
    mem8[loc_608c] = 0x0f;
    a = (a - 1) & 0xff;
    if (a === 0) a = 0x01;
    let x = 0;
    for (;;) {
      x = (x + 1) & 0xff;
      const shiftOut = (mem8[loc_79] >> 7) & 1;
      mem8[loc_79] = (mem8[loc_79] << 1);
      const top = (a >> 7) & 1;
      a = ((a << 1) | shiftOut) & 0xff;
      if (top !== 0) break;                       // stop once a 1 rolls out
    }
    y = ((((a >> 1) ^ 0x7f) + 1) & 0xff);         // exponent
    a = x;                                        // mantissa shift count
  }
  mem8[loc_78] = a;
  const saved = a & 0xff;
  a = y;
  y = mem8[loc_a9];
  const ptr = mem8[loc_74] | (mem8[loc_75] << 8);
  mem8[u16(ptr + y)] = a;
  y = (y + 1) & 0xff;
  mem8[u16(ptr + y)] = (saved | 0x70);
}
