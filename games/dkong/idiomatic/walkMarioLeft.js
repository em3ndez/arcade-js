// SPDX-License-Identifier: GPL-3.0-only
/**
 * walkMarioLeft — drive one frame of Mario's LEFTWARD ground walk.  ROM 0x1CAB.
 *
 * The movement cascade tail-jumps here (from walkLeftWhileHeld, ROM 0x1AFB) on any frame the
 * cooked control word says "walk left". It is the mirror image of the rightward stepper at
 * ROM 0x1C8F; the two differ in exactly three constants, and every one of
 * them is visible below.
 *
 * The walk is paced by the shared sub-step timer MARIO_MOVE_STEP_TIMER, which gives two
 * distinct frames:
 *
 *   - Timer still running — a step is already in progress, so this frame only shifts
 *     Mario one pixel further along it: hand a delta of −1 (one pixel LEFT; the rightward
 *     stepper hands +1) to advanceMarioWalkX, which moves MARIO_X, re-snaps his Y to the
 *     sloped girder on 25m, ticks the timer down and refreshes his sprite record.
 *
 *   - Timer expired — begin the NEXT walk-animation step. MARIO_WALK_ANIM is advanced one
 *     place around its four-value ring by nextAnimationStep: with this routine's ring selector the
 *     ring runs 0 → 1 → 4 → 2 → 0, and the rightward stepper's selector walks the same
 *     ring the other way (0 → 2 → 4 → 1 → 0) — which is exactly why the two directions
 *     produce the same set of animation values in reversed order. The new index is stored
 *     back, and its low two bits become this step's walk tile (the ring's four values mask
 *     down to the tile sequence 0, 1, 0, 2). That tile is handed to beginWalkStep, which
 *     publishes it as Mario's sprite code, rings the footstep on the odd tile, re-arms the
 *     sub-step timer and refreshes the sprite record.
 *
 * FACING. Mario's sprite code carries "facing right" in bit 7. This routine leaves that
 * bit CLEAR — the single constant that makes it the leftward stepper rather than a copy
 * of the rightward one, which sets it before entering the same shared tail.
 *
 * OFF-RING GUARD, deliberately absent. nextAnimationStep scans a packed table for a field matching
 * its selector and spins forever when none matches, so a MARIO_WALK_ANIM outside
 * {0, 1, 2, 3, 4} hangs the ROM. No guard is added here: the two walk steppers are the
 * only writers of that cell and they keep it on the ring, and a cap would silently turn a
 * faithful hang into a wrong terminating result.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1cab.test.js.
 * GATE:     real captured attract dispatches (naturally reachable: the 25m demo walks
 *           Mario left, 149 dispatches inside 1400 frames, both arms and all four
 *           MARIO_WALK_ANIM ring values occurring) PLUS an exhaustive crafted sweep of the
 *           routine's whole decision surface — all 256 MARIO_MOVE_STEP_TIMER values, and
 *           every MARIO_WALK_ANIM value on which nextAnimationStep terminates — on 25m and on a
 *           non-25m board. Teeth: an inverted timer branch, a rightward (+1) walk delta,
 *           the rightward stepper's facing bit, and the rightward ring selector — the
 *           three-constant difference from the rightward twin — each caught.
 * LIVE-OUT: memory-only — MARIO_WALK_ANIM here, plus everything the chosen callee writes
 *           (MARIO_X / MARIO_Y / MARIO_MOVE_STEP_TIMER / MARIO_SPRITE_CODE /
 *           SND_TRIGGER[0] / the four sprite-record bytes). The caller reaches this by an
 *           unconditional tail-jump and consumes no register or flag it leaves; the return
 *           value is void on both arms and must stay void, since the cascade propagates it
 *           and a truthy value would read as a caller-skip. The chain nets exactly one
 *           caller-return, which the gate's pc + SP comparison pins.
 * NAMES:    MARIO_MOVE_STEP_TIMER (0x620F), MARIO_WALK_ANIM (0x6202) — from ram.js.
 *           advanceMarioWalkX (ROM 0x1CD2), nextAnimationStep (ROM 0x3009) and beginWalkStep
 *           (ROM 0x1CC2) are already idiomatic and called directly. beginWalkStep still
 *           takes its walk tile in the accumulator (its own oracle-boundary ABI, not yet
 *           promoted to a parameter), so the tile is staged there for it.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./ram.js";
import { advanceMarioWalkX } from "./advanceMarioWalkX.js"; // ROM 0x1CD2
import { nextAnimationStep } from "./nextAnimationStep.js";                   // ROM 0x3009
import { beginWalkStep } from "./beginWalkStep.js";         // ROM 0x1CC2

// One pixel LEFT, as the byte-wrapping delta advanceMarioWalkX adds to MARIO_X.
// (The rightward stepper at ROM 0x1C8F hands 1.)
const WALK_STEP_LEFT = 255;

// Ring selector handed to nextAnimationStep: picks the packed table whose fields step
// MARIO_WALK_ANIM 0 -> 1 -> 4 -> 2 -> 0. The rightward stepper passes 5, which picks the
// table that walks the same four values the other way.
const LEFT_WALK_RING = 0x01;

// The walk tile is the low two bits of the ring index; the ring's 0/1/4/2 therefore
// animates as tiles 0, 1, 0, 2.
const WALK_TILE_MASK = 0x03;

/**
 * @param {import("../machine.js").Machine} m
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
