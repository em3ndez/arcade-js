// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginWalkStep — start a new walk-animation step for Mario.  ROM 0x1cc2.
 *
 * The horizontal-walk steppers (loc_1c8f walking right, loc_1cab walking left) reach
 * here on the frame their sub-step timer has expired and it is time to advance the walk
 * to its NEXT animation frame. They hand over the sprite-code byte they just built — the
 * walk-cycle tile in the low bits, plus the facing-right flag in bit 7 (set by the
 * rightward stepper) — and this routine commits the step:
 *
 *   1. Publish that byte as this frame's Mario tile (MARIO_SPRITE_CODE).
 *   2. Ring the footstep sound on alternate steps only: the low bit of the walk-cycle
 *      counter toggles each new step, so the footstep clicks every other step, not every
 *      one.
 *   3. Re-arm the sub-step pacer (MARIO_MOVE_STEP_TIMER) for the next two 1px shift
 *      frames before the walk animation advances again.
 *   4. Refresh Mario's hardware sprite record from his live fields — the shared tail of
 *      the whole mover — then return to the movement cascade.
 *
 * Reached on 25m during the attract walk; both arms (footstep / no footstep) occur. The
 * sprite-code byte arrives in a register from the still-oracle steppers, so it is read
 * at that boundary rather than taken as a parameter.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1cc2.test.js.
 * GATE:     crafted-entry — real captured 25m dispatches cover both the footstep and
 *           no-footstep arms; crafted entries force each arm and pin the sprite-code
 *           store, the footstep routing, and the timer reload. Teeth: an inverted
 *           footstep phase, a dropped timer reload, and a skipped sprite refresh, each
 *           caught.
 * LIVE-OUT: memory-only — MARIO_SPRITE_CODE, MARIO_MOVE_STEP_TIMER, SND_TRIGGER[0] (on
 *           the footstep phase) and the four sprite-record bytes. The callers reach here
 *           by an unconditional tail-jump and consume no register/flag this leaves; the
 *           oracle's residual A/HL/flags are dead ABI (pc/SP model the single tail
 *           return, supplied by the harness).
 * NAMES:    MARIO_SPRITE_CODE (0x6207), MARIO_MOVE_STEP_TIMER (0x620F) — from ram.js.
 *           triggerWalkSound (0x1d8f) and writeMarioSpriteRecord (0x1da6) called direct.
 */

import { MARIO_SPRITE_CODE, MARIO_MOVE_STEP_TIMER } from "../optimized/ram.js";
import { triggerWalkSound } from "./triggerWalkSound.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

// Each walk step is paced over two 1px shift frames before the animation advances again.
const WALK_SUBSTEP_FRAMES = 2;

export function beginWalkStep(m) {
  const { regs, mem } = m;

  // The walk arm hands over the sprite-code byte it built (walk-cycle tile + facing
  // bit 7). Publish it as this frame's Mario tile.
  const spriteCode = regs.a;
  mem.write8(MARIO_SPRITE_CODE, spriteCode);

  // Footstep on alternate steps only: the low bit of the walk-cycle counter toggles each
  // new step, so ring the sound only when it is set.
  const footstepPhase = (spriteCode & 1) === 1;
  if (footstepPhase) triggerWalkSound(m);

  // Re-arm the sub-step pacer for the next two 1px shift frames.
  mem.write8(MARIO_MOVE_STEP_TIMER, WALK_SUBSTEP_FRAMES);

  // Shared mover tail: refresh Mario's hardware sprite record, then return to the cascade.
  return writeMarioSpriteRecord(m);
}
