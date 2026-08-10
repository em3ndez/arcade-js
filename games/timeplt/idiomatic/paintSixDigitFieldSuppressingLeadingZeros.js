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

export function paintSixDigitFieldSuppressingLeadingZeros(m) {
  const { regs } = m;
  regs.b = 0;
  paintTwoSuppressedDigitsFromByte(m);
  regs.hl = u16(regs.hl - 1);
  paintTwoSuppressedDigitsFromByte(m);
  regs.hl = u16(regs.hl - 1);
  paintTwoUnsuppressedDigitsFromByte(m);
}
