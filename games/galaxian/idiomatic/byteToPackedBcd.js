// SPDX-License-Identifier: GPL-3.0-only
//
// byteToPackedBcd (ROM 0x2569) -- [seen]
//
// WHAT IT IS
//   Convert a binary byte to packed binary-coded decimal: take the value modulo 100 and lay its two
//   decimal digits into one byte -- tens in the high nibble, units in the low nibble -- returning the
//   result in the accumulator (m.regs.a).
//
// ROLE IN THE MACHINE
//   The binary-to-BCD converter the HUD field renderer and the coin/credit lines lean on when they
//   have a plain binary count (a credit total, a nibble readout) that must be painted as decimal
//   glyphs. The mod-100 clamp means only the low two decimal digits survive -- anything a caller needs
//   beyond 99 it handles itself. Default arg mirrors the register convention (A holds the input byte).
//
// LIVE-OUT: A = packed BCD of (value % 100); returned as well.
export function byteToPackedBcd(m, value = m.regs.a) {
  // Reduce to the low two decimal digits (0..99); the tens/units split below assumes this range.
  const twoDigit = value % 100;
  // Pack tens into bits 4-7 and units into bits 0-3 -- the packed-BCD form the digit painter decodes.
  const packed = (Math.floor(twoDigit / 10) << 4) | (twoDigit % 10);
  // Publish the packed byte back in A (the caller reads it from the accumulator).
  return (m.regs.a = packed);
}
