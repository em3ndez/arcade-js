// SPDX-License-Identifier: GPL-3.0-only
/**
 * splitBcdByte — turn one packed-BCD byte into two on-screen decimal digits. [seen]
 * (ROM 0x0429)
 *
 * The game keeps its scores and counters in PACKED BCD: each byte holds two decimal digits,
 * one per nibble — the tens digit in the high nibble, the units digit in the low nibble
 * (so 0x37 means the decimal pair "3" and "7"). The HUD renderers walk those bytes and paint
 * them as tiles. This is the primitive that unpacks one such byte a digit at a time.
 *
 * On each call it handles the LOW (units) digit itself: it masks off the high nibble and
 * writes the remaining 0..9 straight to the destination tile cell, then steps the cursor
 * forward by `advance` (the stride between adjacent digit cells in the tile map). It hands the
 * HIGH (tens) digit back to the caller, which paints that one and decides, for the next byte
 * up, where it goes. So a multi-byte number is drawn by calling in per byte and threading the
 * returned cursor through.
 *
 * The high digit doubles as the LEADING-ZERO test: when it comes back 0, the caller knows this
 * position is a leading zero and can blank it instead of drawing a "0" (the Z-sense below).
 * That is how scores show " 1230" rather than "001230".
 *
 * A PURE LEAF: one read (the BCD byte), one write (the units tile). It calls nothing. In the
 * ROM the whole byte is stashed in C across the store so the high nibble can be recovered
 * afterwards; the idiomatic form just keeps it in a local.
 *
 * LIVE-OUT: three values the caller reads back —
 *   A  the high (tens) digit, 0..9, ready to paint.
 *   HL the cursor advanced one cell past the units digit (dst + advance, 16-bit).
 *   Z  set when the high digit is 0 — the leading-zero flag.
 * The units digit has already been written to the tile at dst.
 */
import { u16 } from "../../../core/int.js";

export function splitBcdByte(m, src = m.regs.ix, dst = m.regs.hl, advance = m.regs.de) {
  const { mem8 } = m;

  // Read the packed-BCD byte to unpack — high nibble = tens, low nibble = units.
  const byte = mem8[src];

  // Units digit: mask to the low nibble (0..9) and paint it into the current cursor cell.
  mem8[dst] = byte & 0x0f; //               low nibble (units digit) -> tile at the cursor

  // Advance the cursor by the inter-digit stride so the caller's next store lands in the
  // adjacent cell. 16-bit wrap matches the Z80 16-bit add.
  const next = u16(dst + advance);

  // Tens digit: shift the high nibble down into 0..9 and hand it back. The caller paints it,
  // and its being zero is the leading-zero signal (Z below).
  const high = (byte >> 4) & 0x0f; //       high nibble (tens digit) handed back; zero => Z-sense

  // Seat the three read-back values: A = tens digit, HL = advanced cursor, Z = tens-is-zero.
  return [m.regs.a = high, m.regs.hl = next, m.regs.fZ = high === 0];
}
