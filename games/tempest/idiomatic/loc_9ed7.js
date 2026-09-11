// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3ee } from "./names.js";

// Look up a direction byte from the ring table, forcing bit7 on. When bit6 of the
// caller's value is set, take the half-turn: step the index back one within a 16-slot
// ring and add 8 to the looked-up value within that ring.
export function loc_9ed7(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  let out;
  if (a & 0x40) {
    y = (y - 1) & 0x0f;
    out = (mem8[u16(loc_3ee + y)] + 8) & 0x0f;
  } else {
    out = mem8[u16(loc_3ee + y)];
  }
  return (m.regs.a = out | 0x80);
}
