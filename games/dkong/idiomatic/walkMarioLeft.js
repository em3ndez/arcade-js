// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkMarioLeft — drive one frame of Mario's LEFTWARD ground walk.
 *
 * The movement cascade hands control here on any frame the cooked control word says "walk
 * left". It is the mirror image of the rightward stepper; the two differ in exactly three
 * constants, and every one of them is visible below.
 *
 * The walk is paced by the shared sub-step timer MARIO_MOVE_STEP_TIMER, which gives two
 * distinct frames:
 *
 *   - Timer still running — a step is already in progress, so this frame only shifts
 *     Mario one pixel further along it: a delta of −1 (one pixel LEFT; the rightward
 *     stepper hands +1) goes to the walk-X mover, which moves MARIO_X, re-snaps his Y to
 *     the sloped girder on 25m, ticks the timer down and refreshes his sprite record.
 *
 *   - Timer expired — begin the NEXT walk-animation step. MARIO_WALK_ANIM is advanced one
 *     place around its four-value ring: with this routine's ring selector the ring runs
 *     0 → 1 → 4 → 2 → 0, and the rightward stepper's selector walks the same ring the
 *     other way (0 → 2 → 4 → 1 → 0) — which is exactly why the two directions produce the
 *     same set of animation values in reversed order. The new index is stored back, and
 *     its low two bits become this step's walk tile (the ring's four values mask down to
 *     the tile sequence 0, 1, 0, 2). That tile goes to the new-step tail, which publishes
 *     it as Mario's sprite code, rings the footstep on the odd tile, re-arms the sub-step
 *     timer and refreshes the sprite record.
 *
 * FACING. Mario's sprite code carries "facing right" in its top bit. This routine leaves
 * that bit CLEAR — the single constant that makes it the leftward stepper rather than a
 * copy of the rightward one, which sets it before entering the same shared tail.
 *
 * OFF-RING GUARD, deliberately absent. The ring stepper scans a packed table for a field
 * matching its selector and spins forever when none matches, so a MARIO_WALK_ANIM outside
 * {0, 1, 2, 3, 4} hangs the game. No guard is added here: the two walk steppers are the
 * only writers of that cell and they keep it on the ring, and a cap would silently turn a
 * faithful hang into a wrong terminating result.
 *
 * LIVE-OUT: memory-only — MARIO_WALK_ANIM here, plus everything the chosen callee writes
 * (MARIO_X, MARIO_Y, the sub-step timer, MARIO_SPRITE_CODE, the footstep sound latch and
 * the four sprite-record bytes). The return value is void on both arms and must STAY void:
 * the cascade propagates it, and a truthy value would read as a caller-skip.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./names.js";
import { advanceMarioWalkX } from "./advanceMarioWalkX.js";
import { nextAnimationStep } from "./nextAnimationStep.js";
import { beginWalkStep } from "./beginWalkStep.js";

// One pixel LEFT, as the byte-wrapping delta the walk-X mover adds to MARIO_X.
// (The rightward stepper hands 1.)
const WALK_STEP_LEFT = 255;

// Ring selector handed to the ring stepper: picks the packed table whose fields step
// MARIO_WALK_ANIM 0 -> 1 -> 4 -> 2 -> 0. The rightward stepper passes 5, which picks the
// table that walks the same four values the other way.
const LEFT_WALK_RING = 0x01;

// The walk tile is the low two bits of the ring index; the ring's 0/1/4/2 therefore
// animates as tiles 0, 1, 0, 2.
const WALK_TILE_MASK = 0x03;

/**
 * @param {object} m  the machine.
 * @returns {void}
 */
export function walkMarioLeft(m) {
  const { regs, mem } = m;

  // A step is already in progress: spend this frame shifting Mario one pixel left.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) {
    return advanceMarioWalkX(m, WALK_STEP_LEFT);
  }

  // The sub-step timer has expired — advance the walk cycle one place around its ring.
  const nextAnim = nextAnimationStep(LEFT_WALK_RING, mem.read8(MARIO_WALK_ANIM)).a;
  mem.write8(MARIO_WALK_ANIM, nextAnim);

  // Hand the new step's walk tile to the shared new-step tail. Bit 7 (facing right) stays
  // clear: this is the leftward stepper.
  regs.a = nextAnim & WALK_TILE_MASK;
  return beginWalkStep(m);
}
