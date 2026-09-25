// SPDX-License-Identifier: GPL-3.0-only
/** paintSixDigitFieldSuppressingLeadingZeros — paint a six-digit field from three packed bytes, stepping the pointer BACK through
 * them a byte at a time while the cursor runs on a cell at a time. The first four digits go
 * through the suppressing painter and share one flag, cleared here, so the field's leading zeros
 * are decided across all four rather than pair by pair; the last two are painted plainly, so no
 * flag can blank them. The colour, the first cell and the byte to start from all arrive from the
 * caller. The pointer, the cursor, the shared flag and the pen thread as explicit values; only the
 * final live-out rides the register file. LIVE-OUT: the cells painted, the cursor six cells on,
 * and the pointer two bytes back. */

import { u16 } from "../../../core/int.js";
import { paintTwoUnsuppressedDigitsFromByte } from "./paintTwoUnsuppressedDigitsFromByte.js";
import { paintTwoSuppressedDigitsFromByte } from "./paintTwoSuppressedDigitsFromByte.js";

export function paintSixDigitFieldSuppressingLeadingZeros(m, hl = m.regs.hl, cursor = m.regs.de, pen = m.regs.c) {
  // the pointer walks a local; the cursor and the shared suppress flag thread as explicit values.
  // the flag starts cleared so the four suppressed digits decide their leading zeros together.
  let flag = 0;
  [flag, cursor] = paintTwoSuppressedDigitsFromByte(m, hl, flag, cursor, pen);
  hl = u16(hl - 1);
  [, cursor] = paintTwoSuppressedDigitsFromByte(m, hl, flag, cursor, pen);
  hl = u16(hl - 1);
  [cursor] = paintTwoUnsuppressedDigitsFromByte(m, hl, cursor, pen);

  // pointer two bytes back and the cursor six cells on; both writes ride the return as the live-out bridge
  return [m.regs.hl = hl, m.regs.de = cursor];
}
