// SPDX-License-Identifier: GPL-3.0-only
/**
 * byteToPackedBcd — convert a binary byte to its packed-BCD decimal form (value mod 100).
 *
 * The Z80 does this the hard way: BCD-correct the low nibble, add decimal 16 once per
 * high-nibble unit, then fold the low digit back in — every step through daa. bcdAddByte
 * reproduces that daa exactly, so the loop stays byte-for-byte with the register version.
 *
 * LIVE-OUT: returns A (the packed-BCD result). The caller reads only A (splits it into HUD
 * digit nibbles); the daa carry-out and the scratch high/low nibbles are not consumed.
 */
import { bcdAddByte } from "../../../core/bcd.js";

export function byteToPackedBcd(m, value = m.regs.a) {
  const low = bcdAddByte(value & 0x0f, 0x00).value; // low nibble, BCD-corrected
  const highUnits = (value & 0xf0) >> 4;

  let acc = 0;
  for (let i = 0; i < highUnits; i++) acc = bcdAddByte(acc, 0x16).value; // weight the high nibble by 16
  return (m.regs.a = bcdAddByte(acc, low).value);
}
