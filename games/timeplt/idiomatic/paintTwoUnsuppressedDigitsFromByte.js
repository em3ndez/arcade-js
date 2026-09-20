// SPDX-License-Identifier: GPL-3.0-only
/** paintTwoUnsuppressedDigitsFromByte — paint the two decimal digits packed into one byte, the high one first, stepping the
 * cursor one cell on after each. The byte is read twice from the pointer the caller is walking,
 * shifted down for the high digit and taken whole for the low; the colour and the cursor arrive
 * as the caller left them. LIVE-OUT: the four cells painted, and the cursor two cells on. */

import { advanceCharCursor } from "./advanceCharCursor.js";
import { paintUnsuppressedDigit } from "./paintUnsuppressedDigit.js";

const HIGH_DIGIT_SHIFT = 4;

export function paintTwoUnsuppressedDigitsFromByte(m, hl = m.regs.hl) {
  const { mem8 } = m;

  paintUnsuppressedDigit(m, mem8[hl] >> HIGH_DIGIT_SHIFT);
  advanceCharCursor(m);

  paintUnsuppressedDigit(m, mem8[hl]);
  advanceCharCursor(m);
}
