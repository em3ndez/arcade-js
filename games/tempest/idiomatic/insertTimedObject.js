// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, SAVED_INDEX, SAVED_INDEX2, TIMED_OBJECT_COUNT, SHAPE_COORD, SHAPE_ID, SHAPE_ACTIVE, SHAPE_ANIM } from "./names.js";

// Insert a new object into the 8-slot table: reuse the first empty slot found,
// or when none is free evict the slot holding the largest counter (and drop the
// live count by one). Fill the chosen slot's four parallel fields, bump the count.
export function insertTimedObject(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = x;
  mem8[SAVED_INDEX2] = y;
  mem8[loc_2a] = 0;
  mem8[loc_2b] = 0;
  let slot = -1;
  for (let i = 7; i >= 0; i--) {
    if (mem8[u16(SHAPE_ACTIVE + i)] === 0) { slot = i; break; }
    const age = mem8[u16(SHAPE_ANIM + i)];
    if (age >= mem8[loc_2a]) {
      mem8[loc_2a] = age;
      mem8[loc_2b] = i;
    }
  }
  if (slot < 0) {
    mem8[TIMED_OBJECT_COUNT] = u8(mem8[TIMED_OBJECT_COUNT] - 1);
    slot = mem8[loc_2b];
  }
  mem8[u16(SHAPE_ANIM + slot)] = 0;
  mem8[u16(SHAPE_ID + slot)] = mem8[COORD_LIST_PTR_LO];
  mem8[u16(SHAPE_ACTIVE + slot)] = mem8[loc_29];
  mem8[u16(SHAPE_COORD + slot)] = mem8[COORD_LIST_PTR_HI];
  mem8[TIMED_OBJECT_COUNT] = u8(mem8[TIMED_OBJECT_COUNT] + 1);
}
