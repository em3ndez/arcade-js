// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { VECRAM_TAIL_CURSOR_LO, VECRAM_TAIL_CURSOR_HI, VEC_LIST_JMP_LO, VEC_LIST_JMP_HI, VEC_LIST_HALT } from "./names.js";

// Emit a vector-RAM record from the 16-bit cursor (low raw, high tagged, plus a
// terminator), then step the cursor down by 32, borrowing into the high byte on underflow.
export function emitVectorTailRecord(m) {
  const { mem8 } = m;
  mem8[VEC_LIST_JMP_LO] = mem8[VECRAM_TAIL_CURSOR_LO];
  mem8[VEC_LIST_JMP_HI] = mem8[VECRAM_TAIL_CURSOR_HI] | 0x70;
  mem8[VEC_LIST_HALT] = 0xc0;
  const stepped = u8(mem8[VECRAM_TAIL_CURSOR_LO] - 0x20);
  if ((stepped & 0x80) !== 0) {
    // Borrowed past zero: carry into the high byte; the low byte wraps into the low half of its range.
    mem8[VECRAM_TAIL_CURSOR_HI] = u8(mem8[VECRAM_TAIL_CURSOR_HI] - 1);
  }
  mem8[VECRAM_TAIL_CURSOR_LO] = stepped & 0x7f;
}
