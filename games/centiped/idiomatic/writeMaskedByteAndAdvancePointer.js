// SPDX-License-Identifier: GPL-3.0-only
import { loc_91, loc_92, loc_ef, loc_f3 } from "./names.js";

/**
 * writeMaskedByteAndAdvancePointer — store one byte through a 16-bit cursor, then step the cursor down.
 *
 * A nonzero byte is XOR'd with the mask cell; a zero byte is stored unmasked. After the store the
 * low half of the cursor advances by the flip-aware stride (0x20 ^ mask), carrying into the high half
 * which also adds a per-column high adjust. Callers seed the cursor and call repeatedly to lay a column.
 * [code]
 */
export function writeMaskedByteAndAdvancePointer(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  const mask = mem8[loc_ef];
  const av = a & 0xff;
  const byte = av === 0 ? 0 : av ^ mask; // a zero byte is stored unmasked

  // Store through the CURRENT cursor (read the pointer before advancing it).
  const target = mem16[loc_91];
  mem8[target] = byte;

  // Advance the low byte by the (flip-aware) stride, carrying into the high byte.
  const lowSum = mem8[loc_91] + (0x20 ^ mask);
  mem8[loc_91] = lowSum;
  const carry = lowSum > 0xff ? 1 : 0;
  const highSum = mem8[loc_f3] + mem8[loc_92] + carry;
  mem8[loc_92] = highSum;
  return (m.regs.fC = highSum > 0xff); // exit carry (register-out): the high-byte advance carry-out
}
