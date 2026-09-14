// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_LOOP_INDEX, POKEY1_AUDCTL, POKEY1_POTGO, POKEY2_AUDCTL, POKEY2_POTGO } from "./names.js";

// Store the incoming value, copy the low three bits of one input cell into a scratch
// byte and a second output cell, then return those bits merged with one relocated bit
// from another input cell.
export function assemblePotStatusByte(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[POKEY2_POTGO] = a;
  const lo = mem8[POKEY2_AUDCTL] & 0x07;
  mem8[SLOT_LOOP_INDEX] = lo;
  mem8[POKEY1_POTGO] = lo;
  const hi = (mem8[POKEY1_AUDCTL] & 0x20) >> 2;
  return (m.regs.a = hi | lo);
}
