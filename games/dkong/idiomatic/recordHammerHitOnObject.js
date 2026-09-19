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
  HAMMER_HIT_HANDLER_RETURN,
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

// The push is load-bearing: the handler unwinds by popping this word, and without it it pops
// the wrong one and unwinds two bytes off.

export function recordHammerHitOnObject(m) {
  const { regs, mem8, mem16 } = m;

  let recordPtr = OBJ_PAIR_6680;
  let active = false;
  for (let i = 0; i < 2; i++) {
    if ((mem8[recordPtr + HAMMER_IN_PLAY] & 0x01) !== 0) { active = true; break; }
    recordPtr += RECORD_STRIDE;
  }
  if (!active) { m.ret(); return; }

  regs.iy = recordPtr;
  regs.c = mem8[recordPtr + OBJ_Y];
  regs.h = mem8[recordPtr + OBJ_HIT_EXTENT_X]; // X base tolerance
  regs.l = mem8[recordPtr + OBJ_HIT_EXTENT_Y]; // Y base tolerance

  m.push16(HAMMER_HIT_HANDLER_RETURN);
  dispatchBoardCollision(m);

  const overlap = regs.a;
  if (overlap === 0) { m.ret(); return; }

  // Always nonzero here; writing it suspends gameplay from the next frame until the effect
  // sequence's teardown clears it.
  mem8[HIT_EFFECT_LATCH] = overlap;
  mem8[COLLIDED_OBJECT_INDEX] = mem8[OBJ_SEARCH_COUNT] - regs.b;
  mem8[COLLIDED_OBJECT_STRIDE] = regs.e;
  mem16[COLLIDED_OBJECT_BASE] = regs.ix;
  m.ret();
}
