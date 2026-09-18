// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkMarioRight — the rightward arm of Mario's per-frame horizontal walk. While the step pacer
 * MARIO_MOVE_STEP_TIMER runs, slide 1px right; when it expires, push MARIO_WALK_ANIM one step
 * through the packed permutation table keyed by 5 (the rightward cycle 0→2→4→1→0) and hand the
 * low-two-bit tile to the step committer with bit 7 set, so Mario faces right. The leftward twin
 * keys the lookup with 1 and commits the tile with bit 7 clear.
 *
 * LIVE-OUT: memory-only — MARIO_WALK_ANIM plus everything the two tails touch (MARIO_X/Y, the
 * pacer, the sprite code, the footstep latch, and Mario's four sprite-record bytes).
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./names.js";
import { nextAnimationStep } from "./nextAnimationStep.js";
import { advanceMarioWalkX } from "./advanceMarioWalkX.js";
import { beginWalkStep } from "./beginWalkStep.js";

const WALK_RIGHT_STEP = 1;
const WALK_CYCLE_RIGHT_KEY = 0x05;
const WALK_TILE_MASK = 0x03;
const FACING_RIGHT = 0x80; // sprite-code bit 7 — horizontal flip, Mario faces right

export function walkMarioRight(m) {
  const { mem8 } = m;

  // Mid-step frame: the pacer has not run out, so just a 1px slide.
  if (mem8[MARIO_MOVE_STEP_TIMER] !== 0) return advanceMarioWalkX(m, WALK_RIGHT_STEP);

  const nextAnim = nextAnimationStep(WALK_CYCLE_RIGHT_KEY, mem8[MARIO_WALK_ANIM]).a;
  mem8[MARIO_WALK_ANIM] = nextAnim;

  return beginWalkStep(m, (nextAnim & WALK_TILE_MASK) | FACING_RIGHT);
}
