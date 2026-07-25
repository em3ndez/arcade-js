// SPDX-License-Identifier: GPL-3.0-only
/**
 * expandBcdDigits — unpack a run of packed BCD/hex bytes into two digit cells each.  ROM 0x0583.
 *
 * The shared body of the packed-counter renderer. A packed byte holds two digits
 * (one per nibble); this loop expands each source byte into two display cells —
 * the HIGH nibble first, then the LOW — writing both through storeDigitAndAdvance
 * (0x0593), which masks a nibble, stores it at [IX], and advances IX by the
 * caller-supplied stride DE. It walks the source pointer HL BACKWARDS so descending
 * source bytes render into ascending display cells (the byte-order reversal that
 * turns a little-endian counter into left-to-right / bottom-to-top digits).
 *
 * A THIRD ENTRY POINT into this block, entered from two callers that share no
 * prologue:
 *   - draw_0578 (0x0578) falls in after setting IX = 0x7641, DE = 0xFFE0 (−0x20,
 *     one tilemap row up per digit), B = 3 — a 3-byte score counter, 6 digits.
 *   - sub_0616 (0x0616) TAIL-JUMPS here with HL = 0x6001, IX = 0x74BF, DE = 0xFFE0,
 *     B = 1 — a one-byte value, 2 digits. Its `ret` returns to sub_0616's caller,
 *     which is the whole point of the tail jump.
 * Because those two share no prologue, the loop is its own routine rather than a
 * second entry flag on draw_0578.
 *
 * Live-in: HL = source pointer (walked back), IX = destination VRAM cursor,
 * DE = per-digit stride, B = source-byte count. Calls storeDigitAndAdvance only.
 *
 * The four `rrca`s in the oracle are a nibble SWAP, not a shift: rotating A right
 * four times drops the high nibble into the low four bits, and storeDigitAndAdvance
 * masks with 0x0F — so the high digit is emitted with no separate shift variant.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0583.test.js.
 * GATE:     crafted-entry — real captured 0x0583 dispatches (attract reaches BOTH
 *           call sites: draw_0578's score column IX=0x7641/0x7781 B=3, and sub_0616's
 *           IX=0x74bf B=1) + crafted entries for the counts/wraps attract does not
 *           vary (B=2, a larger B, HL dec-underflow, IX add-wrap, and a source byte
 *           whose two nibbles differ so the swap is observable). Not exhaustive — a
 *           store makes it a memory function of (HL, IX, DE, B, source bytes), not a
 *           scalar. Teeth: a twin that emits LOW-then-HIGH (skips the nibble swap),
 *           caught on every capture with a source byte whose nibbles differ.
 * LIVE-OUT: memory + IX + A + HL + B (all reproduced identically to the oracle and
 *           compared). Memory = the 2·B digit cells written via storeDigitAndAdvance
 *           — the real output. IX = the cursor past the last digit; HL = source − B;
 *           B = 0 at loop exit; A = the last low digit (masked). DE is unchanged.
 *           FLAGS are dropped as dead: `dec hl` (16-bit) and `djnz` set none, so the
 *           only survivor is the carry the final `add ix,de` (inside 0x0593) leaves —
 *           the oracle itself left that "unresolved" past three returns; the pixel
 *           capstone backstops it.
 * NAMES:    none from ram.js — HL/IX/DE/B and the destination cells are all
 *           caller-supplied; this routine references no fixed game RAM address.
 */
import { storeDigitAndAdvance } from "./storeDigitAndAdvance.js"; // ROM 0x0593

export function expandBcdDigits(m) {
  const { regs, mem } = m;

  do {
    const src = mem.read8(regs.hl);

    // Four `rrca`s = a nibble swap: the high digit rotates down into the low four
    // bits. storeDigitAndAdvance masks with 0x0F, so it stores the HIGH digit.
    regs.a = ((src >> 4) | (src << 4)) & 0xff;
    storeDigitAndAdvance(m); // write high digit at [IX], IX += DE

    // Reload the same byte; its low nibble is already in place for the LOW digit.
    regs.a = mem.read8(regs.hl);
    storeDigitAndAdvance(m); // write low digit at [IX], IX += DE

    regs.hl = (regs.hl - 1) & 0xffff; // dec hl — walk the source backwards
    regs.b = (regs.b - 1) & 0xff;     // djnz — one iteration per source byte
  } while (regs.b !== 0);
}
