// SPDX-License-Identifier: GPL-3.0-only
/**
 * expandBcdDigits — expand a packed BCD counter into individual digit cells, high nibble first.
 * The source pointer walks backwards while the destination cursor walks forwards, reversing a
 * least-significant-byte-first counter into reading order.
 *
 * LIVE-OUT: the digit cells written, plus the loop-exit registers (cursor past the last digit,
 * source stepped back past every byte, count zero, last low digit).
 */
import { storeDigitAndAdvance } from "./storeDigitAndAdvance.js";

export function expandBcdDigits(m) {
  const { regs, mem8 } = m;

  do {
    const src = mem8[regs.hl];

    // Swap the nibbles so the HIGH digit sits where the shared store's mask will find it.
    storeDigitAndAdvance(m, ((src >> 4) | (src << 4)) & 0xff);

    storeDigitAndAdvance(m, mem8[regs.hl]);

    regs.hl = (regs.hl - 1) & 0xffff;
    regs.b = (regs.b - 1) & 0xff;
  } while (regs.b !== 0);
}
