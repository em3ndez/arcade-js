// SPDX-License-Identifier: GPL-3.0-only
/**
 * recordHammerHitOnObject — scan the hammer pair for the in-play record, hand its reference
 * point and swing-pose hitbox to the current board's collision handler, and on an overlap
 * record the struck hazard (hit marker, its index within the sweep array, the array's stride
 * low byte, and the array's base).
 *
 * The hitbox is a pair of per-axis BASE TOLERANCES, not a second position — reading
 * OBJ_HIT_EXTENT_X/Y as a low/high coordinate pair is wrong.
 *
 * LIVE-OUT: memory-only.
 */

import {
  COLLIDED_OBJECT_BASE,
  COLLIDED_OBJECT_INDEX,
  COLLIDED_OBJECT_STRIDE,
  HAMMER_IN_PLAY,
  HIT_EFFECT_LATCH,
  OBJ_HIT_EXTENT_X,
  OBJ_HIT_EXTENT_Y,
  OBJ_PAIR_6680,
  OBJ_SEARCH_COUNT,
  OBJ_Y,
} from "./names.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js";

const RECORD_STRIDE = 0x10;

export function recordHammerHitOnObject(m) {
  const { mem8, mem16 } = m;

  let recordPtr = OBJ_PAIR_6680;
  let active = false;
  for (let i = 0; i < 2; i++) {
    if ((mem8[recordPtr + HAMMER_IN_PLAY] & 0x01) !== 0) { active = true; break; }
    recordPtr += RECORD_STRIDE;
  }
  if (!active) return;

  const { overlap, residue, stride, base } = dispatchBoardCollision(m, {
    iy: recordPtr,
    c: mem8[recordPtr + OBJ_Y],
    bounds: (mem8[recordPtr + OBJ_HIT_EXTENT_X] << 8) | mem8[recordPtr + OBJ_HIT_EXTENT_Y],
  });
  if (overlap === 0) return;

  // Writing the hit marker suspends gameplay from the next frame until the effect sequence clears it.
  mem8[HIT_EFFECT_LATCH] = overlap;
  mem8[COLLIDED_OBJECT_INDEX] = mem8[OBJ_SEARCH_COUNT] - residue;
  mem8[COLLIDED_OBJECT_STRIDE] = stride;
  mem16[COLLIDED_OBJECT_BASE] = base;
}
