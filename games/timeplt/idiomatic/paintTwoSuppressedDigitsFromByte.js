// SPDX-License-Identifier: GPL-3.0-only
/** paintTwoSuppressedDigitsFromByte — paint the two decimal digits packed into one byte, the high one first, stepping the
 * cursor one cell on after each, with a leading zero suppressed. The byte is read twice from the
 * pointer the caller is walking, shifted down for the high digit and taken whole for the low. The
 * caller's suppression flag arrives, carries across both digits and goes back out, so a longer run
 * of digits shares one flag. The pointer, the flag, the cursor and the pen arrive as explicit
 * values and the flag and cursor are handed back; nothing threads through the register file here.
 * LIVE-OUT: the four cells painted, the cursor two cells on, the flag. */

import { u8 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { paintSuppressedDigit } from "./paintSuppressedDigit.js";

const HIGH_DIGIT_SHIFT = 4;

export function paintTwoSuppressedDigitsFromByte(m, hl = m.regs.hl, flag = m.regs.b, cursor = m.regs.de, pen = m.regs.c) {
  const { mem8 } = m;

  // the flag carries between the two digits; the cursor is stepped one cell on after each. The digit
  // painter returns the flag PRE-WRAP (an assignment yields its RHS before the register's width mask),
  // so wrap it to a byte to match what the register carries to the next digit.
  let [carriedFlag, , , cell] = paintSuppressedDigit(m, mem8[hl] >> HIGH_DIGIT_SHIFT, flag, pen, hl, cursor);
  carriedFlag = u8(carriedFlag);
  cell = advanceCharCursor(m, cell);

  [carriedFlag, , , cell] = paintSuppressedDigit(m, mem8[hl], carriedFlag, pen, hl, cell);
  carriedFlag = u8(carriedFlag);
  cell = advanceCharCursor(m, cell);

  return [carriedFlag, cell];
}
