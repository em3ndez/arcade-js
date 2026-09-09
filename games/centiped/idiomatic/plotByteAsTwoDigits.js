// SPDX-License-Identifier: GPL-3.0-only
import { plotNormalizedCharCode } from "./plotNormalizedCharCode.js";

/**
 * plotByteAsTwoDigits — plot a byte as its two nibble digits (high then low) through the draw cursor.
 *
 * The entry carry selects digit mode for the high nibble. The low nibble inherits carry only when the
 * high nibble was a zero digit in that mode; otherwise its carry is cleared, matching the plot helper's
 * blanking of a zero digit. [code]
 *
 * Exit carry (register-out): the low-nibble plot's exit carry — set only when the low digit inherited
 * carry AND was itself a zero digit, i.e. the whole byte was zero in digit mode.
 * Exposed as `return (m.regs.fC = ...)`: sets the flag for any register-bridge consumer and returns it.
 */
export function plotByteAsTwoDigits(m, a = m.regs.a, carrySet = m.regs.fC) {
  const byte = a & 0xff;
  const high = byte >> 4;
  plotNormalizedCharCode(m, high, carrySet);
  const lowCarry = carrySet && high === 0;
  plotNormalizedCharCode(m, byte & 0x0f, lowCarry);
  return (m.regs.fC = lowCarry && (byte & 0x0f) === 0);
}
