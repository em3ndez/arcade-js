// SPDX-License-Identifier: GPL-3.0-only
/**
 * expandBcdDigits — expand a packed BCD counter into individual digit cells, high nibble first.
 * The source pointer walks backwards while the destination cursor walks forwards, reversing a
 * least-significant-byte-first counter into reading order.
 *
 * LIVE-OUT: the digit cells written, plus the loop-exit registers (cursor past the last digit,
 * source stepped back past every byte, count zero, last low digit).
 */
import { u16 } from "../../../core/int.js";
import { storeDigitAndAdvance } from "./storeDigitAndAdvance.js";

export function expandBcdDigits(m, hl = m.regs.hl, b = m.regs.b, ix = m.regs.ix, de = m.regs.de) {
  const { mem8 } = m;

  do {
    const src = mem8[hl];

    // Swap the nibbles so the HIGH digit sits where the shared store's mask will find it.
    ix = storeDigitAndAdvance(m, ((src >> 4) | (src << 4)) & 0xff, ix, de)[0];

    ix = storeDigitAndAdvance(m, mem8[hl], ix, de)[0];

    hl = u16(hl - 1);
    b = (b - 1) & 0xff;
  } while (b !== 0);

  return [m.regs.hl = hl, m.regs.b = b]; // re-seat the loop-exit source/count for the bridge
}
