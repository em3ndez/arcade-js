// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_9e, loc_9f, SLOT_LOOP_INDEX, OBJ_DEPTH, loc_29, HIGH_LEVEL_MARKER, loc_720,
  SHAPE_ACTIVE, SHAPE_COORD, SHAPE_ID, SHAPE_ANIM, ENEMY_SHAPE_BASE,
} from "./names.js";
import { animateShapeOneVector } from "./animateShapeOneVector.js";
import { seatShapeParamsAndEmit } from "./seatShapeParamsAndEmit.js";

// Walk the eight active slots top-down, emitting each non-empty slot's shape record
// (a special case for shape 1), then latch a saved byte when a flag and threshold hold.
export function drawEnemyShapeList(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x00;
  mem8[SLOT_LOOP_INDEX] = 0x07;
  while (true) {
    const slot = mem8[SLOT_LOOP_INDEX];
    const cell = mem8[u16(SHAPE_ACTIVE + slot)];
    if (cell !== 0) {
      mem8[OBJ_DEPTH] = cell;
      mem8[loc_29] = mem8[u16(SHAPE_COORD + slot)];
      const shape = mem8[u16(SHAPE_ID + slot)];
      if (shape === 1) {
        animateShapeOneVector(m);
      } else {
        let base = (mem8[u16(SHAPE_ANIM + slot)] >> 1) & 0xfe;
        if (shape >= 2) base = 0x00;
        const val = (base + mem8[u16(ENEMY_SHAPE_BASE + shape)]) & 0xff;
        seatShapeParamsAndEmit(m, val, mem8[loc_29]);
      }
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;
  }
  if (mem8[loc_720] === 0) return;
  const saved = mem8[loc_9f];
  if (saved < 0x0d) return;
  mem8[HIGH_LEVEL_MARKER] = saved;
}
