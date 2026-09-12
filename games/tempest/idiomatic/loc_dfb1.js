// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0, loc_ae, loc_af } from "./names.js";
import { loc_df19 } from "./loc_df19.js";

// Emit a run of y zeropage bytes, top index a+y-1 downward: each byte's high
// nibble then its low nibble, chaining carry so only the final low nibble sees
// it cleared (the terminator marker).
export function loc_dfb1(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  let count = (y - 1) & 0xff;
  mem8[loc_ae] = count;
  let x = (a + count) & 0xff;
  let carry = true;
  do {
    mem8[loc_af] = x;
    const byte = mem8[u16(loc_0 + x)];
    const high = byte >> 4;
    loc_df19(m, high, carry);
    const carryHigh = carry && high === 0;
    const last = count === 0;
    const carryLow = last ? false : carryHigh;
    loc_df19(m, byte, carryLow);
    carry = carryLow && (byte & 0x0f) === 0;
    x = (mem8[loc_af] - 1) & 0xff;
    count = (mem8[loc_ae] - 1) & 0xff;
    mem8[loc_ae] = count;
  } while (count < 0x80);
}
