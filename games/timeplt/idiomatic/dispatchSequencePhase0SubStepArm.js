// SPDX-License-Identifier: GPL-3.0-only
/** dispatchSequencePhase0SubStepArm — run the arm the low three bits of the inner sequence step select out of a word table laid down inline just behind
 * this entry. The table never changes while the game runs, so each case below is the literal target its
 * slot held, dispatched directly rather than through a jump computed from the read-out value. Only two of
 * the eight slots name a transcribed arm; the other six point at bytes that carry no routine, so reaching
 * one is a fault and it is raised, not assumed away. The selector value is kept in `a` for the arm, exactly
 * as it stood when the read-out arithmetic finished. LIVE-OUT: memory, and the arm's. */

import { NotImplemented } from "../../../boards/timeplt/io.js";
import { SEQUENCE_SUBSTEP } from "./names.js";
import { startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase } from "./startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase.js";
import { armAttractScreenShowingHighScore } from "./armAttractScreenShowingHighScore.js";

const ARM_MASK = 0x07;

export function dispatchSequencePhase0SubStepArm(m) {
  const index = m.mem8[SEQUENCE_SUBSTEP] & ARM_MASK;
  switch (index) {
    // Slot 0 -> the whole-plane-wipe arm (its inline table word). Slot 6 -> the attract high-score
    // arm. The selector rides into each on `a`, the value the read-out arithmetic left there.
    case 0: return (m.regs.a = index, startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase(m));
    case 6: return (m.regs.a = index, armAttractScreenShowingHighScore(m));
    // Slots 1-5 and 7 hold words that address bytes this port has not transcribed as routines; the
    // inline dispatch would jump into them and fault, so surface the same fault here instead.
    default:
      throw new NotImplemented(`dispatchSequencePhase0SubStepArm: phase-0 sub-step arm ${index} is not a transcribed routine`);
  }
}
