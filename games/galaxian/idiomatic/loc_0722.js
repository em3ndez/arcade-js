// SPDX-License-Identifier: GPL-3.0-only
// Mode-flag state step. When the mode flag's bit0 is clear, advance the sub-state counter and reload the
// dwell timer. When it is set, reset to state 1: game-state = 1, clear the mode flag and sequence state,
// silence the sound hardware and halt the interrupt/starfield, then queue command word 6.
import { GAME_STATE, SEQUENCE_STATE, loc_4006 } from "./names.js";
import { advanceSubstateAndReloadDwell } from "./advanceSubstateAndReloadDwell.js";
import { silenceSoundAndDisableIrqStars } from "./silenceSoundAndDisableIrqStars.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function loc_0722(m, counter = m.regs.hl) {
  const { mem8 } = m;

  if ((mem8[loc_4006] & 0x01) === 0) return advanceSubstateAndReloadDwell(m, counter);

  mem8[GAME_STATE] = 1;
  mem8[loc_4006] = 0;
  mem8[SEQUENCE_STATE] = 0;
  silenceSoundAndDisableIrqStars(m);
  return enqueueCommandWord(m, 6 << 8); // queue command word 6
}
