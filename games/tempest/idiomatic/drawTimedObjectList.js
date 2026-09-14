// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, loc_40, loc_42, DRAW_STYLE, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DEPTH_LO, DEPTH_HI,
  loc_9e, loc_9f, loc_a0, SPIKE_TABLE_GUARD, loc_11f, PLAYER_SEGMENT, loc_3fe,
} from "./names.js";
import { loc_df4c } from "./loc_df4c.js";
import { emitColoredShapeVector } from "./emitColoredShapeVector.js";

// While the guard flag is set, force three cursor cells and, for each nonzero slot in
// the eight-entry table, pick a draw mode and emit it; then restore the saved cells.
// Tail: when the second flag is set and the counter is high enough, bump one counter.
export function drawTimedObjectList(m) {
  const { mem8 } = m;
  if (mem8[SPIKE_TABLE_GUARD] !== 0) {
    const save5f = mem8[DEPTH_HI];
    const save5b = mem8[DEPTH_LO];
    const saveA0 = mem8[loc_a0];
    mem8[DEPTH_HI] = 0xe8;
    mem8[DEPTH_LO] = 0xff;
    mem8[loc_a0] = 0x28;
    // Walk the eight slots top-down; the shared index wraps past zero to end the pass.
    mem8[SLOT_LOOP_INDEX] = 0x07;
    for (;;) {
      const slot = mem8[SLOT_LOOP_INDEX];
      const entry = mem8[u16(loc_3fe + slot)];
      if (entry !== 0) {
        mem8[OBJ_DEPTH] = entry;
        mem8[PROJ_PT_Y] = 0x80;
        mem8[PROJ_PT_X] = 0x80;
        let mode;
        if (mem8[loc_9f] >= 0x05) {
          mode = slot & 0x07;
          if (mode === 0x07) mode = 0x04;
        } else {
          mode = 0x06;
        }
        mem8[loc_9e] = mode;
        loc_df4c(m, 0x08, mem8[loc_9e]);
        mem8[DRAW_STYLE] = u8(((slot & 0x03) << 1) + 0x0a);
        emitColoredShapeVector(m);
      }
      mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
      if (mem8[SLOT_LOOP_INDEX] & 0x80) break;
    }
    mem8[loc_a0] = saveA0;
    mem8[DEPTH_LO] = save5b;
    mem8[DEPTH_HI] = save5f;
  }
  if (mem8[loc_11f] === 0) return;
  if (mem8[loc_42] < 0x15) return;
  const k = mem8[loc_40];
  mem8[u16(PLAYER_SEGMENT + k)] = u8(mem8[u16(PLAYER_SEGMENT + k)] + 1);
}
