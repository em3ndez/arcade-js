// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { TIMED_OBJECT_COUNT, SHAPE_ID, SHAPE_ACTIVE, SHAPE_ANIM, TIMED_OBJ_LIMIT_TABLE, TIMED_OBJ_STEP_TABLE } from "./names.js";

// If the pending flag is clear, do nothing. Otherwise clear it and advance every
// live slot's counter by its per-type step; a slot that reaches its per-type limit
// is freed, any slot still short re-raises the pending flag for the next pass.
export function loc_a416(m) {
  const { mem8 } = m;
  if (mem8[TIMED_OBJECT_COUNT] === 0) return;
  mem8[TIMED_OBJECT_COUNT] = 0;
  for (let i = 7; i >= 0; i--) {
    if (mem8[u16(SHAPE_ACTIVE + i)] === 0) continue;
    const type = mem8[u16(SHAPE_ID + i)];
    const next = u8(mem8[u16(SHAPE_ANIM + i)] + mem8[u16(TIMED_OBJ_STEP_TABLE + type)]);
    mem8[u16(SHAPE_ANIM + i)] = next;
    if (next < mem8[u16(TIMED_OBJ_LIMIT_TABLE + type)]) {
      mem8[TIMED_OBJECT_COUNT] = u8(mem8[TIMED_OBJECT_COUNT] + 1);
    } else {
      mem8[u16(SHAPE_ACTIVE + i)] = 0;
    }
  }
}
