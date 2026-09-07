// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDwellOrResetToState1 (ROM 0x0722) -- the shared "carry on vs. game over" fork at the tail
 * of the play sub-state-6 handlers.
 *
 * WHAT IT IS
 *   The in-play sequence sits in sub-state 6, and both of its handlers (stepPlaySubstate6 and
 *   stepAltPlaySubstate6) funnel through this shared tail. It is a two-way branch on the mode flag
 *   loc_4006 (0x4006): with bit 0 clear the game simply advances its sub-state and re-arms the dwell
 *   timer; with bit 0 set it tears the play field down and resets the whole machine to state 1 --
 *   i.e. game over, back toward attract.
 *
 * ROLE IN THE MACHINE
 *   Called from the sub-state-6 handlers (mechanisms.md, "The attract / sequence state machine",
 *   step 6). The `counter` param defaults to the caller's HL, which is the dwell-timer cell the
 *   advance path reloads. The reset path writes GAME_STATE (0x4005) = 1, clears the mode flag
 *   loc_4006 and SEQUENCE_STATE (0x400a), calls silenceSoundAndDisableIrqStars to quiet the sound
 *   hardware and halt the interrupt/starfield latches, and finally enqueues command word 6.
 *
 * Grounding: [seen] (names.js cert for 0x0722).
 *
 * LIVE-OUT (reset path): GAME_STATE=1, loc_4006=0, SEQUENCE_STATE=0, plus the sound/IRQ/starfield
 *   silencing and the queued command word. Advance path: whatever advanceSubstateAndReloadDwell leaves.
 */
import { GAME_STATE, SEQUENCE_STATE, loc_4006 } from "./names.js";
import { advanceSubstateAndReloadDwell } from "./advanceSubstateAndReloadDwell.js";
import { silenceSoundAndDisableIrqStars } from "./silenceSoundAndDisableIrqStars.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function advanceDwellOrResetToState1(m, counter = m.regs.hl) {
  const { mem8 } = m;

  // Mode flag loc_4006 bit 0 clear -> "carry on": bump the sub-state counter at `counter` (HL) and
  // reload the dwell timer, delegating the whole step to advanceSubstateAndReloadDwell.
  if ((mem8[loc_4006] & 0x01) === 0) return advanceSubstateAndReloadDwell(m, counter);

  // Mode flag bit 0 set -> "game over": reset the machine toward attract at state 1.
  // Restart the top-level game state ...
  mem8[GAME_STATE] = 1;
  // ... clear the mode flag so the next turn does not immediately reset again ...
  mem8[loc_4006] = 0;
  // ... rewind the sequence state-machine to its first step ...
  mem8[SEQUENCE_STATE] = 0;
  // ... silence the sound hardware and drop the interrupt-enable / starfield latches ...
  silenceSoundAndDisableIrqStars(m);
  // ... and hand a command word to the deferred-command queue (6 in the high byte).
  return enqueueCommandWord(m, 6 << 8); // queue command word 6
}
