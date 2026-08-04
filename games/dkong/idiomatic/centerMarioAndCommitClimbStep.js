// SPDX-License-Identifier: GPL-3.0-only
/**
 * centerMarioAndCommitClimbStep — the ladder-centering phase of a climb step: snap Mario onto the
 * ladder column, tick the alternating climb footstep, then commit his sprite.
 *
 * The climb animation advances Mario's Y by one step each frame and flips a two-phase centering
 * counter; on the phase that lands here it finalises the step by:
 *
 *   1. snapping MARIO_X onto the ladder column — forcing the low 3 bits to 3, i.e.
 *      X := (X & ~7) | 3. Ladders sit on an 8-pixel grid, so this re-glues Mario to the column
 *      each centering step, correcting any horizontal drift left over from walking before he
 *      mounted the ladder.
 *   2. toggling MARIO_CLIMB_SOUND_TOGGLE and, on the frame it flips to 0, requesting the footstep
 *      ("walk") sound — so a step blips every other frame.
 *   3. tailing into the on-ladder commit: re-assert MARIO_ON_LADDER, then copy Mario's updated
 *      position and sprite code into his hardware sprite record, so the record picks up the
 *      just-centered X.
 *
 * The caller arrives with its pointer at Mario's Y byte and the hardware sequence steps back two
 * bytes to his X; this writes MARIO_X directly instead.
 *
 * LIVE-OUT: memory-only — MARIO_X (centered), MARIO_CLIMB_SOUND_TOGGLE (toggled), the footstep
 * sound latch on the fire phase, and everything the on-ladder commit writes (MARIO_ON_LADDER plus
 * the 4-byte sprite record). No live registers or flags: the tail returns unconditionally and every
 * caller consumes only memory.
 */

import { MARIO_X, MARIO_CLIMB_SOUND_TOGGLE } from "./names.js";
import { triggerWalkSound } from "./triggerWalkSound.js";
import { markOnLadderAndCommitSprite } from "./markOnLadderAndCommitSprite.js";

export function centerMarioAndCommitClimbStep(m) {
  const { mem } = m;

  // 1. Snap Mario onto the ladder column: force X's low 3 bits to 3.
  mem.write8(MARIO_X, (mem.read8(MARIO_X) & ~7) | 3);

  // 2. Alternate the climb footstep: flip the phase, blip the walk sound on the 0 phase.
  const climbSoundPhase = mem.read8(MARIO_CLIMB_SOUND_TOGGLE) ^ 1;
  mem.write8(MARIO_CLIMB_SOUND_TOGGLE, climbSoundPhase);
  if (climbSoundPhase === 0) triggerWalkSound(m);

  // 3. Re-assert on-ladder and refresh Mario's sprite record with the centered position.
  markOnLadderAndCommitSprite(m);
}
