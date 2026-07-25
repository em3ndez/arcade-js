// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeDigitAndAdvance — write one BCD/hex digit to the destination cell, then step the cursor.  ROM 0x0593.
 *
 * The innermost leaf of the BCD-counter renderer. Its callers draw a packed BCD
 * value one digit at a time: draw_0578/loop_0583 render a 3-byte counter down a
 * video column, and sub_057c unpacks 3 source bytes into 6 nibbles up a column.
 * Each hands this routine a value in A, a destination pointer in IX, and a stride
 * in DE, and calls it once per digit. It:
 *
 *   - masks A to its low nibble (`and 0x0f`) — one BCD/hex digit, 0..F — the caller
 *     loop having already rotated the wanted nibble down into the low four bits
 *     (the four `rrca`s for a high digit, or no rotation for a low one);
 *   - stores that digit at the current destination cell [IX] (a VRAM tile cell);
 *   - advances IX by DE — the caller-supplied stride (e.g. 0xFFE0 = −0x20 = one
 *     tilemap row up) — so it stays position-agnostic and the caller owns the
 *     direction and spacing between successive digits.
 *
 * A LEAF: calls nothing. Reads A/IX/DE; writes the one cell at IX and advances IX.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0593.test.js.
 * GATE:     crafted-entry — real captured 0x0593 dispatches (attract renders the
 *           high-score column: IX = 0x7641, DE = 0xFFE0, A = a packed score byte,
 *           high nibble set so the 0x0F mask does real work) + crafted entries for
 *           the arms attract does not vary: a positive/down stride, an A whose high
 *           nibble must be masked away, and the IX-advance 16-bit wrap. Not
 *           exhaustive — a store makes it a memory function of (A, IX, DE), not a
 *           scalar. Teeth: a twin that stores A UNMASKED (skips `and 0x0f`), caught
 *           on every capture whose A high nibble is nonzero. Reached from the digit
 *           renderers whenever a BCD counter is drawn.
 * LIVE-OUT: memory + IX + A. Memory = the one nibble written at the entry IX. IX =
 *           that pointer advanced by DE, which the caller loop consumes as the next
 *           digit's cell (genuinely live — the whole point of the caller-owned
 *           stride). A = the masked nibble; the loop reloads A next digit, so A is
 *           dead there, but it is produced identically to the oracle and compared for
 *           free. FLAGS are dropped as dead: the flags `and 0x0f`/`add ix,de` leave
 *           are overwritten inside BOTH caller loops before any read (the next
 *           digit's `and 0x0f`, or the loop-back `rrca`); the sole survivor is the
 *           final iteration's carry via the loop-exit `ret`, which the oracle itself
 *           left "unresolved" and which the pixel capstone backstops.
 * NAMES:    none from ram.js — A/IX/DE and the destination cell are all
 *           caller-supplied; the routine references no fixed game RAM address.
 */
export function storeDigitAndAdvance(m) {
  const { regs, mem } = m;

  const digit = regs.a & 0x0f;             // and 0x0f — mask to one BCD/hex nibble
  mem.write8(regs.ix, digit);              // ld (ix+0x00),a — store the digit at the cell
  regs.ix = (regs.ix + regs.de) & 0xffff;  // add ix,de — step the cursor by the stride

  // Live-out register state matching the oracle: A holds the masked nibble.
  regs.a = digit;
}
