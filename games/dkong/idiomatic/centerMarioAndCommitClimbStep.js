// SPDX-License-Identifier: GPL-3.0-only
/**
 * centerMarioAndCommitClimbStep — the ladder-centering phase of a climb step: snap MARIO_X onto
 * the ladder column (force low 3 bits to 3), toggle the alternating climb footstep and blip the
 * walk sound on the 0 phase, then tail into the on-ladder commit that refreshes Mario's sprite.
 *
 * LIVE-OUT: memory-only — MARIO_X, MARIO_CLIMB_SOUND_TOGGLE, the footstep sound latch on the fire
 * phase, and everything the on-ladder commit writes.
 */

import { MARIO_X, MARIO_CLIMB_SOUND_TOGGLE } from "./names.js";
import { triggerWalkSound } from "./triggerWalkSound.js";
import { markOnLadderAndCommitSprite } from "./markOnLadderAndCommitSprite.js";

export function centerMarioAndCommitClimbStep(m) {
  const { mem8 } = m;

  mem8[MARIO_X] = (mem8[MARIO_X] & ~7) | 3;

  const climbSoundPhase = mem8[MARIO_CLIMB_SOUND_TOGGLE] ^ 1;
  mem8[MARIO_CLIMB_SOUND_TOGGLE] = climbSoundPhase;
  if (climbSoundPhase === 0) triggerWalkSound(m);

  markOnLadderAndCommitSprite(m);
}
