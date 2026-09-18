// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkMarioLeft — one frame of Mario's leftward ground walk. Mirror of the rightward
 * stepper: while the sub-step timer runs it shifts Mario one pixel left; on expiry it
 * advances MARIO_WALK_ANIM one place around its ring and enters the shared new-step tail
 * with facing-right (bit 7) left clear.
 *
 * LIVE-OUT: memory-only — MARIO_WALK_ANIM plus everything the chosen callee writes. The
 * return value is void on both arms and must stay void: a truthy value reads as a caller-skip.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./names.js";
import { advanceMarioWalkX } from "./advanceMarioWalkX.js";
import { nextAnimationStep } from "./nextAnimationStep.js";
import { beginWalkStep } from "./beginWalkStep.js";

const WALK_STEP_LEFT = 255; // one pixel LEFT as a byte-wrapping delta (rightward stepper hands 1)
const LEFT_WALK_RING = 0x01; // ring selector: steps MARIO_WALK_ANIM 0 -> 1 -> 4 -> 2 -> 0
const WALK_TILE_MASK = 0x03;

export function walkMarioLeft(m) {
  const { mem8 } = m;

  if (mem8[MARIO_MOVE_STEP_TIMER] !== 0) {
    return advanceMarioWalkX(m, WALK_STEP_LEFT);
  }

  const nextAnim = nextAnimationStep(LEFT_WALK_RING, mem8[MARIO_WALK_ANIM]).a;
  mem8[MARIO_WALK_ANIM] = nextAnim;

  return beginWalkStep(m, nextAnim & WALK_TILE_MASK);
}
