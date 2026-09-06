// SPDX-License-Identifier: GPL-3.0-only
// Sub-state 6 handler. Two arms select on the show flag. When the advance gate is closed the arm
// delegates (show set -> set the sequence state by mode + reload the dwell; show clear -> the shared
// dwell/reset tail). When the gate is open, advance the sub-state and re-arm the dwell timer -- 80 on the
// show arm, 130 on the default arm; on the default arm, when the sound-enable bit is set, queue two
// sound command words.
import { SEQUENCE_STATE, loc_421d, loc_4195, loc_4006, loc_4009 } from "./names.js";
import { setSequenceStateByModeAndReloadDwell } from "./setSequenceStateByModeAndReloadDwell.js";
import { advanceDwellOrResetToState1 } from "./advanceDwellOrResetToState1.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function loc_07e8(m) {
  const { mem8 } = m;
  const advanceArmed = mem8[loc_4195] !== 0; // gate open -> advance the sub-state inline

  if (mem8[loc_421d] !== 0) {
    if (!advanceArmed) return setSequenceStateByModeAndReloadDwell(m, SEQUENCE_STATE);
    mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
    mem8[loc_4009] = 80;
    return;
  }

  if (!advanceArmed) return advanceDwellOrResetToState1(m, SEQUENCE_STATE);
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4009] = 130;
  if ((mem8[loc_4006] & 1) === 0) return; // sound-enable bit clear -> no sound
  enqueueCommandWord(m, (6 << 8) | 3);
  return enqueueCommandWord(m, 6 << 8);
}
