// SPDX-License-Identifier: GPL-3.0-only
import { plotNormalizedCharCode } from "./plotNormalizedCharCode.js";

/**
 * plotByteAsTwoDigits — print one byte as its two hex-nibble digits, high nibble first then low,
 * each drawn through `plotNormalizedCharCode` and the shared draw cursor.
 *
 * Role in the machine: this is the two-digit number printer that the readout builders stack up to
 * lay whole packed-BCD/hex numbers on screen (object coordinates, config table values, score-style
 * fields). A single byte carries two digits, so this splits it into its two nibbles and prints each
 * as a hex digit. The important subtlety is LEADING-ZERO SUPPRESSION carried by the carry flag:
 *   - The ENTRY carry picks digit mode for the high nibble (carry set means "still in the leading-zero
 *     run, blank a zero digit").
 *   - The low nibble inherits that carry ONLY when the high nibble was itself a zero digit; otherwise
 *     its carry is cleared, because once a non-zero digit has printed the leading-zero run is over and
 *     every following digit must be shown even if it is zero. This exactly matches the plot helper's
 *     rule of blanking a zero digit only while carry is held. [code]
 *
 * Grounding: [code] — nibble split and carry threading read from behaviour.
 *
 * Live-out (register-out): the EXIT CARRY — the low-nibble plot's exit carry, set only when the low
 * digit inherited carry AND was itself a zero digit, i.e. the WHOLE byte was zero in digit mode. That
 * lets a chain of these printers carry one continuous leading-zero run across a multi-byte number.
 * Exposed as `return (m.regs.fC = ...)`: it both sets the flag bridge for any register-bridge consumer
 * and returns the boolean for a direct idiomatic caller.
 */
export function plotByteAsTwoDigits(m, a = m.regs.a, carrySet = m.regs.fC) {
  const byte = a & 0xff;
  // Split the byte into its two hex digits. High nibble prints first (left-to-right on screen).
  const high = byte >> 4;
  // Print the high digit in the entry carry's mode. Its own exit carry is not captured directly;
  // instead we recompute the equivalent "was a blanked zero" condition below to feed the low digit.
  plotNormalizedCharCode(m, high, carrySet);
  // The low digit stays in leading-zero-blanking mode only if we were blanking AND the high digit
  // was a zero (so nothing non-zero has printed yet). Any non-zero high digit clears this, forcing
  // the low digit to be shown.
  const lowCarry = carrySet && high === 0;
  // Print the low digit (mask off the high nibble) in that inherited mode.
  plotNormalizedCharCode(m, byte & 0x0f, lowCarry);
  // Exit carry = the run is still unbroken through BOTH digits: we were blanking into the low digit
  // and the low digit was also zero, i.e. the entire byte printed as blanks. Publish it for the next
  // printer in the chain.
  return (m.regs.fC = lowCarry && (byte & 0x0f) === 0);
}
