// SPDX-License-Identifier: GPL-3.0-only
import { loc_37, loc_60c8, loc_60cb, loc_60d8, loc_60db } from "./names.js";

// Store the incoming value, copy the low three bits of one input cell into a scratch
// byte and a second output cell, then return those bits merged with one relocated bit
// from another input cell.
export function loc_dbe0(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[loc_60db] = a;
  const lo = mem8[loc_60d8] & 0x07;
  mem8[loc_37] = lo;
  mem8[loc_60cb] = lo;
  const hi = (mem8[loc_60c8] & 0x20) >> 2;
  return (m.regs.a = hi | lo);
}
