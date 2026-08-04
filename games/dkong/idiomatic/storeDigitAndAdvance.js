// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeDigitAndAdvance — write one BCD/hex digit to the destination cell, then step the cursor.
 *
 * The innermost leaf of the BCD-counter renderer. The digit-drawing loops above it render a
 * packed BCD value one digit at a time — down a video column for a 3-byte counter, or up one
 * for a 3-byte value unpacked into six nibbles. Each hands this routine a value in A, a
 * destination pointer in IX, and a stride in DE, and calls it once per digit. It:
 *
 *   - masks A to its low nibble — one BCD/hex digit, 0..F — the caller loop having already
 *     rotated the wanted nibble down into the low four bits;
 *   - stores that digit at the current destination cell [IX], a tilemap cell in video memory;
 *   - advances IX by DE — the caller-supplied stride, which for a column of digits is one
 *     tilemap row up or down — so it stays position-agnostic and the caller owns the direction
 *     and spacing between successive digits.
 *
 * A LEAF: calls nothing. Reads A/IX/DE; writes the one cell at IX and advances IX. Nothing it
 * touches is a fixed game-RAM address: the value, the destination and the stride all arrive
 * from the caller.
 *
 * LIVE-OUT: memory + IX + A. Memory = the one nibble written at the entry IX. IX = that
 * pointer advanced by DE, which the caller loop consumes as the next digit's cell — genuinely
 * live, and the whole point of the caller-owned stride. A = the masked nibble. Flags are not
 * reproduced: every caller overwrites them before reading one.
 */
export function storeDigitAndAdvance(m) {
  const { regs, mem } = m;

  const digit = regs.a & 0x0f;             // mask to one BCD/hex nibble
  mem.write8(regs.ix, digit);              // store the digit at the cell
  regs.ix = (regs.ix + regs.de) & 0xffff;  // step the cursor by the caller's stride

  // Live-out register state: A holds the masked nibble.
  regs.a = digit;
}
