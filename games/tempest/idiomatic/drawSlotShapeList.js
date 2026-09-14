// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, SLOT_STATE, OBJ_DEPTH, loc_2f, TARGET_SEG, FRAME_COUNTER, ACTIVE_OBJECT_COUNT, COLOR_RAM_8 } from "./names.js";
import { seatShapeParamsAndEmit } from "./seatShapeParamsAndEmit.js";

// Walk twelve slots high-to-low, emitting each non-empty entry's shape, then latch a level byte.
export function drawSlotShapeList(m) {
  const { mem8 } = m;
  mem8[SLOT_LOOP_INDEX] = 0x0b;
  while (true) {
    const x = mem8[SLOT_LOOP_INDEX];
    const entry = mem8[u16(SLOT_STATE + x)];
    if (entry !== 0) {
      mem8[OBJ_DEPTH] = entry;
      mem8[loc_2f] = entry;
      const y = mem8[u16(TARGET_SEG + x)];
      // Near slots use a fixed value; far slots derive one from the phase counter.
      const a = x >= 0x08 ? (((mem8[FRAME_COUNTER] << 1) & 0x06) + 0x20) & 0xff : 0x08;
      seatShapeParamsAndEmit(m, a, y);
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;
  }
  // Latch a level byte selected by the current stage value.
  const level = mem8[ACTIVE_OBJECT_COUNT];
  mem8[COLOR_RAM_8] = level < 0x06 ? 0x04 : level < 0x08 ? 0x0b : 0x0c;
}
