// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_139, loc_13a, loc_2ffc, loc_2ffd, loc_2fff } from "./names.js";

// Emit a vector-RAM record from the 16-bit cursor (low raw, high tagged, plus a
// terminator), then step the cursor down by 32, borrowing into the high byte on underflow.
export function loc_b896(m) {
  const { mem8 } = m;
  mem8[loc_2ffc] = mem8[loc_139];
  mem8[loc_2ffd] = mem8[loc_13a] | 0x70;
  mem8[loc_2fff] = 0xc0;
  const stepped = u8(mem8[loc_139] - 0x20);
  if ((stepped & 0x80) !== 0) {
    // Borrowed past zero: carry into the high byte; the low byte wraps into the low half of its range.
    mem8[loc_13a] = u8(mem8[loc_13a] - 1);
  }
  mem8[loc_139] = stepped & 0x7f;
}
