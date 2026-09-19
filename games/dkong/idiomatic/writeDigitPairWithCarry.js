// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeDigitPairWithCarry — stamp two digit tiles two columns apart (a column is 2 bytes here),
 * spilling a right value of exactly 10 into a fixed tens cell so it shows as two digits.
 *
 * Tile codes and digit values coincide, so writing the number writes the digit. The tail is
 * load-bearing: it OVERWRITES the caller's cell and digit registers with a second fixed set, and the
 * caller falls straight back into this code so the second pass consumes them — a deliberate hand-off,
 * not a failure to preserve.
 *
 * LIVE-OUT: the two digit cells, the tens cell on the value-10 arm, and the target cell and digit
 * pair the second pass runs with.
 */
import { u16 } from "../../../core/int.js";

export function writeDigitPairWithCarry(m, e = m.regs.e, d = m.regs.d, hl = m.regs.hl) {
  const { regs, mem8 } = m;

  mem8[hl] = e;
  const secondCell = u16(hl + 2);
  mem8[secondCell] = d;

  if (d === 0x0a) {
    mem8[secondCell] = 0x00; // ones digit
    mem8[0x758e] = 0x01; //    tens digit
  }

  regs.de = 0x0201;
  regs.hl = 0x768c;
}
