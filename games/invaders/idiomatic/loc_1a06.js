// SPDX-License-Identifier: GPL-3.0-only
import { loc_2072 } from "./names.js";

// Object-direction predicate: carry := (mem[de] & 0x80) === the reference flag byte -- the object's
// direction bit (bit7 of the byte at DE) against that flag. Callers dispatch this via m.call and skip
// the object when carry is clear (direction mismatch). Two load-bearing live-outs: the carry, and HL
// left at the flag address by the address-load (a frozen caller advances HL and reads through it).
export function loc_1a06(m, de = m.regs.de) {
  return (m.regs.hl = loc_2072, m.regs.fC = (m.mem8[de] & 0x80) === m.mem8[loc_2072]);
}
