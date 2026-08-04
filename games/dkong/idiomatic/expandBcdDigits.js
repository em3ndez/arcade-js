// SPDX-License-Identifier: GPL-3.0-only
/**
 * expandBcdDigits — turn a packed counter into the individual digit cells that draw it on screen.
 *
 * Each source byte holds two digits, one per nibble. The loop emits the HIGH digit first, then the
 * LOW one, pushing both through a shared store-and-advance step: that step masks a nibble, writes
 * it at the destination cursor, and moves the cursor on by the caller's stride.
 *
 * The source pointer walks BACKWARDS while the cursor walks forwards. That is the byte-order
 * reversal that turns a counter stored least-significant-byte-first into digits laid out in
 * reading order on screen.
 *
 * Everything comes in as registers, so the same loop serves callers drawing counters of different
 * lengths at different places: the source pointer, the destination cursor, the per-digit stride,
 * and the number of source bytes to expand. It always emits two digits per source byte.
 *
 * Getting the HIGH digit out is a nibble SWAP, not a shift. The byte's two halves are exchanged so
 * the high digit lands in the low four bits, which is where the shared store's mask looks — so one
 * store serves both digits and there is no separate high-digit variant.
 *
 * LIVE-OUT: the digit cells written, plus the register state the loop leaves and the caller may
 * use: the cursor sitting past the last digit, the source pointer stepped back past every byte it
 * read, a count of zero, and the last low digit. The stride is unchanged, and the flags are dead.
 */
import { storeDigitAndAdvance } from "./storeDigitAndAdvance.js";

export function expandBcdDigits(m) {
  const { regs, mem } = m;

  do {
    const src = mem.read8(regs.hl);

    // Swap the nibbles so the HIGH digit sits where the shared store's mask will find it.
    regs.a = ((src >> 4) | (src << 4)) & 0xff;
    storeDigitAndAdvance(m); // high digit out, cursor advances

    // Reload the same byte; its low nibble is already in place for the LOW digit.
    regs.a = mem.read8(regs.hl);
    storeDigitAndAdvance(m); // low digit out, cursor advances

    regs.hl = (regs.hl - 1) & 0xffff; // walk the source backwards
    regs.b = (regs.b - 1) & 0xff;     // one iteration per source byte
  } while (regs.b !== 0);
}
