// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeDigitAndAdvance — the innermost leaf of the BCD-counter renderer. Masks A
 * to its low nibble (one BCD/hex digit), stores it at the destination cell [IX] in
 * video memory, then advances IX by the caller-supplied stride DE.
 *
 * LIVE-OUT: memory + IX (advanced by DE, the next digit's cell) + A (the masked nibble).
 */
export function storeDigitAndAdvance(m) {
  const { regs, mem8 } = m;

  const digit = regs.a & 0x0f;
  mem8[regs.ix] = digit;
  regs.ix = (regs.ix + regs.de) & 0xffff;

  regs.a = digit;
}
