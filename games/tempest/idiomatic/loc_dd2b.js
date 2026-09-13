// SPDX-License-Identifier: GPL-3.0-only
import { SAVED_INDEX, SLOT_LOOP_INDEX } from "./names.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_df1f } from "./loc_df1f.js";

// Scale the two coordinates into the vector work pair, then shift the stashed byte
// out MSB-first, emitting each of its eight bits as one vector digit.
export function loc_dd2b(m, y = m.regs.y, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = y;
  loc_df75(m, a, x);
  mem8[SLOT_LOOP_INDEX] = 0x07;
  let a2;
  do {
    const shifted = mem8[SAVED_INDEX] << 1;
    mem8[SAVED_INDEX] = shifted;
    a2 = loc_df1f(m, (shifted >> 8) & 1);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);
  // Exit A (live-out) is the cursor value left by the eighth (last) digit emit.
  return (m.regs.a = a2);
}
