// SPDX-License-Identifier: GPL-3.0-only
/** paintSixDigitFieldSuppressingLeadingZeros — paint a six-digit field from three packed bytes, stepping the pointer BACK through
 * them a byte at a time while the cursor runs on a cell at a time. The first four digits go
 * through the suppressing painter and share one flag, cleared here, so the field's leading zeros
 * are decided across all four rather than pair by pair; the last two are painted plainly, so no
 * flag can blank them. The colour, the first cell and the byte to start from all arrive from the
 * caller. LIVE-OUT: the cells painted, the cursor six cells on, and the pointer two bytes back. */

import { u16 } from "../../../core/int.js";
import { paintTwoUnsuppressedDigitsFromByte } from "./paintTwoUnsuppressedDigitsFromByte.js";
import { paintTwoSuppressedDigitsFromByte } from "./paintTwoSuppressedDigitsFromByte.js";

export function paintSixDigitFieldSuppressingLeadingZeros(m, hl = m.regs.hl) {
  const { regs } = m;
  // the pointer walks a local; the cursor and the shared flag thread through the machine, since the
  // three painters below still read them there. The flag is cleared so the four suppressed digits decide together.
  regs.hl = hl;
  regs.b = 0;
  paintTwoSuppressedDigitsFromByte(m);
  regs.hl = hl = u16(hl - 1);
  paintTwoSuppressedDigitsFromByte(m);
  regs.hl = hl = u16(hl - 1);
  paintTwoUnsuppressedDigitsFromByte(m);

  // pointer two bytes back and the cursor six cells on; the pointer write keeps the bridge for a dispatched caller
  return [regs.hl = hl, regs.de];
}
