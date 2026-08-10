// SPDX-License-Identifier: GPL-3.0-only
/** paintTwoSuppressedDigitsFromByte — paint the two decimal digits packed into one byte, the high one first, stepping the
 * cursor one cell on after each, with a leading zero suppressed. The byte is read twice from the
 * pointer the caller is walking, shifted down for the high digit and taken whole for the low. The
 * caller's suppression flag arrives, carries across both digits and goes back out, so a longer run
 * of digits shares one flag. LIVE-OUT: the four cells painted, the cursor two cells on, the flag. */

import { advanceCharCursor } from "./advanceCharCursor.js";
import { paintSuppressedDigit } from "./paintSuppressedDigit.js";

const HIGH_DIGIT_SHIFT = 4;

export function paintTwoSuppressedDigitsFromByte(m) {
  const { regs, mem8 } = m;

  regs.a = mem8[regs.hl] >> HIGH_DIGIT_SHIFT;
  paintSuppressedDigit(m);
  advanceCharCursor(m);

  regs.a = mem8[regs.hl];
  paintSuppressedDigit(m);
  advanceCharCursor(m);
}
