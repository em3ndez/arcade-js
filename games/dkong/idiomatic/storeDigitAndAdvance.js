// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeDigitAndAdvance — the innermost leaf of the BCD-counter renderer. Masks A
 * to its low nibble (one BCD/hex digit), stores it at the destination cell [IX] in
 * video memory, then advances IX by the caller-supplied stride DE.
 *
 * LIVE-OUT: memory + IX (advanced by DE, the next digit's cell) + A (the masked nibble).
 */
import { u16 } from "../../../core/int.js";

export function storeDigitAndAdvance(m, a = m.regs.a, ix = m.regs.ix, de = m.regs.de) {
  const { regs, mem8 } = m;

  const digit = a & 0x0f;
  mem8[ix] = digit;
  regs.ix = u16(ix + de);

  regs.a = digit;
}
