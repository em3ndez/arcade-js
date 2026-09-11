// SPDX-License-Identifier: GPL-3.0-only
import { loc_2a, loc_111 } from "./names.js";

// Compute A minus Y, stash it, then either keep the full byte or a sign-extended low nibble
// depending on a flag: if the flag's high bit is set keep the full difference, else mask to the
// low four bits and sign-extend when bit 3 is set. Returns the result the caller reads back.
export function loc_a7a6(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  a = (a - y) & 0xff;
  mem8[loc_2a] = a;            // stash the difference
  if (mem8[loc_111] & 0x80) {  // flag high bit set -> keep the full difference
    return (m.regs.a = a);
  }
  a &= 0x0f;                   // else take the low nibble
  if (a & 0x08) a |= 0xf8;     // sign-extend the nibble into a signed byte
  return (m.regs.a = a);
}
