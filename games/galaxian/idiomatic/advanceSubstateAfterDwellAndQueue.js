// SPDX-License-Identifier: GPL-3.0-only
// State-timer handler: tick the timer byte. While nonzero, done. On its zero-cross reload the timer,
// advance the sequence state, and enqueue this state's command word.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { loc_4009, SEQUENCE_STATE, loc_0682 } from "./names.js";

const TIMER_RELOAD = 20;

export function advanceSubstateAfterDwellAndQueue(m) {
  const { mem8 } = m;

  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  mem8[loc_4009] = TIMER_RELOAD;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  return enqueueCommandWord(m, loc_0682, SEQUENCE_STATE);
}
