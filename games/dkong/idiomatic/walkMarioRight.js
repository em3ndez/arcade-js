// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkMarioRight — the RIGHTWARD arm of Mario's per-frame horizontal walk.
 *
 * Reached on a frame the player (or the attract demo) is holding Right and Mario is walking on
 * foot. A walk is paced in two tiers: a run of cheap 1px shift frames, then one frame that
 * advances the walk-cycle animation and re-arms the pacer. MARIO_MOVE_STEP_TIMER is that pacer,
 * and it picks the tier:
 *
 *   - pacer still running -> hand the frame to the horizontal-walk step with a +1 delta: Mario
 *     slides one pixel right (and, on the girder board, his Y re-snaps to the sloped girder under
 *     the new X), then one frame is spent off the pacer.
 *   - pacer expired -> step the walk-cycle animation. MARIO_WALK_ANIM is pushed one step through a
 *     packed permutation table, keyed by the byte 5 — the rightward cycle; the leftward twin keys
 *     the same lookup with 1. The result is stored back as the new animation index, and its low
 *     two bits — the walk tile — are handed to the step committer with bit 7 set, the sprite-code
 *     flag that flips Mario to face RIGHT. That committer publishes the tile, rings the footstep
 *     on the odd tile, and re-arms the pacer.
 *
 * The rightward cycle this drives is 0 -> 2 -> 4 -> 1 -> 0 (a walk-anim value of 3, which the
 * cycle never produces, folds into it at 1), giving the repeating tile run 2, 0, 1, 0. The facing
 * bit is what distinguishes this arm from the leftward one, which stores the same masked tile with
 * bit 7 CLEAR and so faces Mario left.
 *
 * Both tiers converge on the mover's shared tail, which refreshes Mario's hardware sprite record,
 * so neither returns a value.
 *
 * LIVE-OUT: memory-only, and no return value. Writes MARIO_WALK_ANIM plus everything the two tails
 * touch — MARIO_X, MARIO_Y, MARIO_MOVE_STEP_TIMER, MARIO_SPRITE_CODE, the footstep sound latch and
 * Mario's four sprite-record bytes. The sole caller reaches here by an unconditional tail-jump and
 * consumes nothing this leaves behind.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./names.js";
import { nextAnimationStep } from "./nextAnimationStep.js";
import { advanceMarioWalkX } from "./advanceMarioWalkX.js";
import { beginWalkStep } from "./beginWalkStep.js";

const WALK_RIGHT_STEP = 1;        // signed 1px shift per mid-step frame, moving right
const WALK_CYCLE_RIGHT_KEY = 0x05; // permutation-table key selecting the rightward walk cycle
const WALK_TILE_MASK = 0x03;      // low two bits of the animation index are the sprite tile
const FACING_RIGHT = 0x80;        // sprite-code bit 7 — horizontal flip, Mario faces right

export function walkMarioRight(m) {
  const { regs, mem } = m;

  // Mid-step frame: the sub-step pacer has not run out, so this frame is just a 1px slide.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) return advanceMarioWalkX(m, WALK_RIGHT_STEP);

  // The pacer expired — advance the walk-cycle animation one step and commit it.
  const nextAnim = nextAnimationStep(WALK_CYCLE_RIGHT_KEY, mem.read8(MARIO_WALK_ANIM)).a;
  mem.write8(MARIO_WALK_ANIM, nextAnim);

  // Hand the step committer this step's sprite code: the walk tile, facing right. It still takes
  // that byte in the machine's accumulator — a live-in it shares with the leftward twin — so it is
  // staged there rather than passed as an argument.
  regs.a = (nextAnim & WALK_TILE_MASK) | FACING_RIGHT;
  return beginWalkStep(m);
}
