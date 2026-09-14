// SPDX-License-Identifier: GPL-3.0-only
import { SAVED_INDEX, SLOT_LOOP_INDEX } from "./names.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitStrokeWordFromNibblePlusOne } from "./emitStrokeWordFromNibblePlusOne.js";

// Scale the two coordinates into the vector work pair, then shift the stashed byte
// out MSB-first, emitting each of its eight bits as one vector digit.
export function emitByteBitsAsDigits(m, y = m.regs.y, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = y;
  emitScaledCoordinateRecord(m, a, x);
  mem8[SLOT_LOOP_INDEX] = 0x07;
  let a2;
  do {
    const shifted = mem8[SAVED_INDEX] << 1;
    mem8[SAVED_INDEX] = shifted;
    a2 = emitStrokeWordFromNibblePlusOne(m, (shifted >> 8) & 1);
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
  } while (mem8[SLOT_LOOP_INDEX] < 0x80);
  // Exit A (live-out) is the cursor value left by the eighth (last) digit emit.
  return (m.regs.a = a2);
}
