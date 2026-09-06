// SPDX-License-Identifier: GPL-3.0-only
// Turn a slope (dividend/divisor) into a 0-7 direction octant: divide the two, treat a top-bit-set
// (too-steep / "negative") quotient as the steepest slope by clamping it to 0x80, then take the top
// three bits of the quotient as the octant.
import { loc_0048 } from "./loc_0048.js";

export function loc_11d0(m, dividend = m.regs.a, divisor = m.regs.d) {
  // The quotient's magnitude is the slope: divide the dividend by the divisor.
  const quotient = loc_0048(m, dividend, divisor);

  // A quotient with its top bit set means the steepest slope -- clamp it to 0x80.
  const clamped = quotient & 0x80 ? 0x80 : quotient;

  // The octant is the top three bits of the clamped quotient (0-7).
  return (m.regs.a = (clamped >> 5) & 0x07);
}
