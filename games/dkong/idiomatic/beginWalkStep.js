// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginWalkStep — commit a new walk-animation step for Mario: publish the built
 * sprite-code byte (walk-cycle tile + facing bit 7, arriving in A from the
 * stepper), ring the footstep on alternate steps, re-arm the sub-step pacer, and
 * refresh Mario's sprite record.
 *
 * LIVE-OUT: memory-only — MARIO_SPRITE_CODE, MARIO_MOVE_STEP_TIMER, the footstep
 * sound latch (on the footstep phase) and the four sprite-record bytes.
 */

import { MARIO_SPRITE_CODE, MARIO_MOVE_STEP_TIMER } from "./names.js";
import { triggerWalkSound } from "./triggerWalkSound.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

const WALK_SUBSTEP_FRAMES = 2;

export function beginWalkStep(m) {
  const { regs, mem8 } = m;

  const spriteCode = regs.a;
  mem8[MARIO_SPRITE_CODE] = spriteCode;

  // Footstep on alternate steps only: the low bit of the walk-cycle counter toggles each step.
  const footstepPhase = (spriteCode & 1) === 1;
  if (footstepPhase) triggerWalkSound(m);

  mem8[MARIO_MOVE_STEP_TIMER] = WALK_SUBSTEP_FRAMES;

  return writeMarioSpriteRecord(m);
}
