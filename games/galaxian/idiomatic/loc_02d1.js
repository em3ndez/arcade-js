// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler: queue two command words, advance the sequence step, and point the
// sequence pointer at the next step's handler.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { SEQUENCE_STATE, loc_4008, advanceObjectPathStepAscending_ADDR } from "./names.js";

export function loc_02d1(m) {
  const { mem8, mem16 } = m;

  enqueueCommandWord(m, (7 << 8) | 1);
  enqueueCommandWord(m, 6 << 8);

  mem8[SEQUENCE_STATE]++;
  mem16[loc_4008] = advanceObjectPathStepAscending_ADDR; // aim the sequence pointer at the next handler
}
