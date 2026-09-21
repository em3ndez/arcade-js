// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeDigitPairWithCarry — stamp two digit tiles two columns apart (a column is 2 bytes here),
 * spilling a right value of exactly 10 into a fixed tens cell so it shows as two digits.
 *
 * Tile codes and digit values coincide, so writing the number writes the digit. The tail is
 * load-bearing: it OVERWRITES the caller's cell and digit registers with a second fixed set the
 * caller falls back into to consume — a deliberate hand-off, not a failure to preserve.
 * LIVE-OUT: the two digit cells, the tens cell on the value-10 arm, and the cell + digit pair the
 * second pass runs with.
 */
import { u16 } from "../../../core/int.js";
import { COINAGE_DIGIT_TENS_CARRY_CELL, TITLE_FIXED_DIGIT_PAIR_LEFT_CELL } from "./names.js";

export function writeDigitPairWithCarry(m, e = m.regs.e, d = m.regs.d, hl = m.regs.hl) {
  const { mem8 } = m;

  mem8[hl] = e;
  const secondCell = u16(hl + 2);
  mem8[secondCell] = d;

  if (d === 0x0a) {
    mem8[secondCell] = 0x00; // ones digit
    mem8[COINAGE_DIGIT_TENS_CARRY_CELL] = 0x01; //    tens digit
  }

  // hand-off to the second pass (frozen caller reads de/hl back)
  return [m.regs.de = 0x0201, m.regs.hl = TITLE_FIXED_DIGIT_PAIR_LEFT_CELL];
}
