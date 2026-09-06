// SPDX-License-Identifier: GPL-3.0-only
// RST-28 sequence-state handler. Branches on the arm gate and the two mode flags to either set the
// sub-state by mode, advance it, or run the shared dwell/reset tail. When the gate is clear and both
// flags are set it inlines the tail itself: bump the sub-state counter, arm the dwell timer, and -- only
// when the mode bit is set -- enqueue two command words.
import { SEQUENCE_STATE, loc_4009, loc_421d, loc_41b5, loc_400e, loc_4006 } from "./names.js";
import { setSequenceStateByModeAndReloadDwell } from "./setSequenceStateByModeAndReloadDwell.js";
import { advanceSubstateAndReloadDwell } from "./advanceSubstateAndReloadDwell.js";
import { advanceDwellOrResetToState1 } from "./advanceDwellOrResetToState1.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const DWELL_RELOAD = 130; // dwell timer value armed on the inlined tail

export function loc_06d8(m) {
  const { mem8 } = m;

  if (mem8[loc_421d]) {
    if (mem8[loc_41b5] && mem8[loc_400e]) return advanceSubstateAndReloadDwell(m, SEQUENCE_STATE);
    return setSequenceStateByModeAndReloadDwell(m, SEQUENCE_STATE);
  }
  if (mem8[loc_41b5] === 0 || mem8[loc_400e] === 0) return advanceDwellOrResetToState1(m, SEQUENCE_STATE);

  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // bump the sub-state counter
  mem8[loc_4009] = DWELL_RELOAD;                   // arm the dwell timer

  if ((mem8[loc_4006] & 1) === 0) return; // proceed only when the mode bit is set

  // enqueue command word 6 with args 2 then 0
  enqueueCommandWord(m, (6 << 8) | 2, loc_4009);
  return enqueueCommandWord(m, 6 << 8, loc_4009);
}
