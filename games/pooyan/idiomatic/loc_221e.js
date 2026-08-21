// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
/**
 * loc_221e — object-clear helper: blank a 0x18-byte record starting at IY with zeros.
 * Points the fill helper at the record and clears the 0x18 bytes to 0.
 * LIVE-OUT: HL = the advanced pointer (base + 0x18) and B = 0, both left by the fill helper
 * (its djnz drains B and callers read that zero); A = 0 (the cleared fill survives in A, as
 * AF is not restored). All set via the return-assignment / callee bridges.
 */
const RECORD_LEN = 0x18;
const CLEAR_FILL = 0x00;

export function loc_221e(m, base = m.regs.iy) {
  const advanced = loc_0010(m, base, CLEAR_FILL, RECORD_LEN); // HL := base+0x18, B := 0
  return (m.regs.a = CLEAR_FILL), advanced; // A := 0 (cleared fill left in A); HL is the advanced pointer
}
