// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c8f — the RIGHTWARD arm of Mario's per-frame horizontal walk.  ROM 0x1C8F.
 *
 * The movement cascade reaches here on a frame the player (or the attract demo) is holding
 * Right and Mario is walking on foot. A walk is paced in two tiers: a run of cheap 1px shift
 * frames, then one frame that advances the walk-cycle animation and re-arms the pacer.
 * MARIO_MOVE_STEP_TIMER is that pacer, and it picks the tier:
 *
 *   - pacer still running -> hand the frame to advanceMarioWalkX with a +1 step: Mario slides
 *     one pixel right (and, on 25m, his Y re-snaps to the sloped girder under the new X),
 *     then one frame is spent off the pacer.
 *   - pacer expired -> step the walk-cycle animation. MARIO_WALK_ANIM is stepped through a
 *     packed permutation table by loc_3009, keyed by the byte 5 (the rightward cycle; the
 *     leftward twin loc_1cab keys the same lookup with 1). The result is stored back as the
 *     new animation index, and its low two bits — the walk tile — are handed to beginWalkStep
 *     with bit 7 set, the sprite-code flag that flips Mario to face RIGHT. beginWalkStep then
 *     publishes the tile, rings the footstep on the odd tile, and re-arms the pacer.
 *
 * The rightward cycle this drives is 0 -> 2 -> 4 -> 1 -> 0 (a walk-anim value of 3, which the
 * cycle never produces, folds into it at 1), giving the repeating tile run 2, 0, 1, 0. The
 * facing bit is what distinguishes this arm from loc_1cab, which stores the same masked tile
 * with bit 7 CLEAR and so faces Mario left.
 *
 * Both tiers converge on the mover's shared tail, which refreshes Mario's hardware sprite
 * record, so neither returns a value.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1c8f.test.js.
 * GATE:     REAL CAPTURED DISPATCHES — the routine is naturally reachable and heavily
 *           exercised: a plain 3000-frame attract run (no pokes, no coin) dispatches 0x1C8F
 *           570x, splitting 380 mid-step / 190 animation-step, and every walk-anim value the
 *           cycle produces (0, 2, 4, 1) arrives as a live input. Crafted entries add the two
 *           arms attract cannot mint: the off-cycle animation value 3, and a non-25m board on
 *           the mid-step arm (attract only ever walks on 25m). Animation inputs of 5 and up
 *           are deliberately NOT tested — loc_3009's lookup has no matching field for them and
 *           spins forever, faithfully to the ROM, on BOTH sides. Each case compares work RAM
 *           minus STACK_SCRATCH, plus pc and SP.
 * LIVE-OUT: memory-only, and no return value. Writes MARIO_WALK_ANIM plus everything the two
 *           tails touch (MARIO_X / MARIO_Y / MARIO_MOVE_STEP_TIMER / MARIO_SPRITE_CODE /
 *           SND_TRIGGER[0] / Mario's four sprite-record bytes). The sole caller (ROM 0x1AE6)
 *           reaches here by an unconditional tail-jump and consumes nothing this leaves, so
 *           the oracle's residual registers and flags are dead ABI; pc/SP model the single net
 *           return, supplied by the harness.
 * NAMES:    MARIO_MOVE_STEP_TIMER (0x620F), MARIO_WALK_ANIM (0x6202) — both from ram.js, which
 *           already records this routine as one of the only two writers of MARIO_WALK_ANIM.
 *           loc_3009 (ROM 0x3009), advanceMarioWalkX (ROM 0x1CD2) and beginWalkStep
 *           (ROM 0x1CC2) are all direct-called; nothing is left on m.call.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./ram.js";
import { loc_3009 } from "./loc_3009.js";
import { advanceMarioWalkX } from "./advanceMarioWalkX.js";
import { beginWalkStep } from "./beginWalkStep.js";

const WALK_RIGHT_STEP = 1;        // signed 1px shift per mid-step frame, moving right
const WALK_CYCLE_RIGHT_KEY = 0x05; // loc_3009 table key selecting the rightward walk cycle
const WALK_TILE_MASK = 0x03;      // low two bits of the animation index are the sprite tile
const FACING_RIGHT = 0x80;        // sprite-code bit 7 — horizontal flip, Mario faces right

export function loc_1c8f(m) {
  const { regs, mem } = m;

  // Mid-step frame: the sub-step pacer has not run out, so this frame is just a 1px slide.
  if (mem.read8(MARIO_MOVE_STEP_TIMER) !== 0) return advanceMarioWalkX(m, WALK_RIGHT_STEP);

  // The pacer expired — advance the walk-cycle animation one step and commit it.
  const nextAnim = loc_3009(WALK_CYCLE_RIGHT_KEY, mem.read8(MARIO_WALK_ANIM)).a;
  mem.write8(MARIO_WALK_ANIM, nextAnim);

  // Hand the step committer this step's sprite code: the walk tile, facing right.
  // (beginWalkStep still takes that byte in the machine's accumulator — its current live-in,
  // shared with the leftward twin — so it is staged there rather than passed as an argument.)
  regs.a = (nextAnim & WALK_TILE_MASK) | FACING_RIGHT;
  return beginWalkStep(m);
}
