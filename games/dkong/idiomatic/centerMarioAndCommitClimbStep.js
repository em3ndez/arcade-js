// SPDX-License-Identifier: GPL-3.0-only
/**
 * centerMarioAndCommitClimbStep — the ladder-centering phase of a climb step: snap
 * Mario onto the ladder column, tick the alternating climb footstep, then commit his
 * sprite.  ROM 0x1D51.
 *
 * The climb animation (loc_1d11) advances Mario's Y by one step each frame and flips a
 * two-phase centering counter; on the phase that lands here it finalises the step by:
 *
 *   1. snapping MARIO_X onto the ladder column — forcing the low 3 bits to 3, i.e.
 *      X := (X & ~7) | 3. Ladders sit on an 8-pixel grid, so this re-glues Mario to the
 *      column each centering step, correcting any horizontal drift left over from walking
 *      before he mounted the ladder.
 *   2. toggling MARIO_CLIMB_SOUND_TOGGLE and, on the frame it flips to 0, requesting the
 *      footstep ("walk") sound via triggerWalkSound — so a step blips every other frame.
 *   3. tailing into markOnLadderAndCommitSprite: re-assert MARIO_ON_LADDER, then copy
 *      Mario's updated position + sprite code into his hardware sprite record (so the
 *      record picks up the just-centered X).
 *
 * Entered from loc_1d11 with its pointer at MARIO_Y (0x6205); the oracle steps down two
 * bytes to MARIO_X (0x6203), so this writes MARIO_X directly.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d51.test.js.
 * GATE:     crafted-entry + real dispatches — attract's 25m demo climbs, so 0x1D51 is
 *           dispatched for real; crafted entries additionally force both toggle phases
 *           (footstep-fire and no-fire) and sweep MARIO_X's low nibble so the snap is
 *           pinned. Teeth: a dropped-center twin and a dropped-footstep twin, both caught.
 *           Ends in a ret (the tail chain returns to loc_1d11's caller), so the gate
 *           compares pc + SP with one net return modeled on the candidate.
 * LIVE-OUT: memory-only — MARIO_X (centered), MARIO_CLIMB_SOUND_TOGGLE (toggled),
 *           SND_TRIGGER[0] (on the fire phase), and everything markOnLadderAndCommitSprite
 *           writes (MARIO_ON_LADDER + the 4-byte sprite record). No live registers/flags:
 *           the tail's ret is unconditional and every caller consumes only memory.
 * NAMES:    MARIO_X, MARIO_CLIMB_SOUND_TOGGLE (ram.js); footstep + sprite commit delegate
 *           to the already-idiomatic triggerWalkSound (0x1D8F) and
 *           markOnLadderAndCommitSprite (0x1D49).
 */

import { MARIO_X, MARIO_CLIMB_SOUND_TOGGLE } from "../optimized/ram.js";
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
