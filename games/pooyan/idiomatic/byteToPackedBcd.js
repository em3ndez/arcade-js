// SPDX-License-Identifier: GPL-3.0-only
/**
 * byteToPackedBcd — convert a binary byte to its packed-BCD decimal form (value mod 100).
 * ROM 0x062a-0x0643. [seen]
 *
 * A leaf number-format helper feeding the HUD. It reads the input byte as two hex nibbles and
 * computes the decimal value hi*16 + lo, returned as packed BCD (two decimal digits per byte,
 * one per nibble). Because the result is a single packed byte it can only hold two digits, so
 * values of 100 and up wrap — the output is value mod 100. A caller downstream splits the packed
 * byte into its two nibbles to draw the tens and units digits.
 *
 * The Z80 does the decimal arithmetic the hard way, with binary add/sub each followed by `daa`
 * (decimal-adjust-accumulator), which fixes up a binary sum into a valid BCD one. Three steps:
 *   - BCD-correct the low nibble on its own (add 0, daa) so it is a clean 0-9 decimal digit.
 *   - Add BCD 0x16 (packed-BCD for decimal 16 — each high-nibble unit is worth sixteen) once for
 *     every unit in the high nibble, daa'ing after each add so the running total stays valid
 *     BCD — this weights the high nibble by 16 in decimal.
 *   - Fold the corrected low digit back in (add, daa) to finish.
 * bcdAddByte reproduces the CPU's daa exactly (it magnitude-corrects both directions, not the
 * textbook flags-only form), so this loop stays byte-for-byte with the register version.
 *
 * LIVE-OUT: returns A (the packed-BCD result). The caller reads only A; the daa carry-out and
 * the scratch high/low nibble values are not consumed.
 */
import { bcdAddByte } from "../../../core/bcd.js";

export function byteToPackedBcd(m, value = m.regs.a) {
  // Isolate and BCD-correct the low nibble on its own: `add 0` then daa yields a clean 0-9
  // decimal digit, held aside (the machine parks it in C) to be folded back in at the end.
  const low = bcdAddByte(value & 0x0f, 0x00).value;
  // The high nibble is the multiplier: how many units of 16 the value carries.
  const highUnits = (value & 0xf0) >> 4;

  // Weight the high nibble by 16 in decimal: add BCD 0x16 (decimal 16) once per high-nibble unit, daa'ing
  // each step so the accumulator stays valid packed BCD as it grows. (When the high nibble is
  // zero the machine skips this loop entirely; the accumulator is already 0.)
  let acc = 0;
  for (let i = 0; i < highUnits; i++) acc = bcdAddByte(acc, 0x16).value;
  // Fold the corrected low digit back in (add, daa) and return the two-digit packed result in A.
  return (m.regs.a = bcdAddByte(acc, low).value);
}
