// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler: queue two command words, advance the sequence step, and re-arm the
// two-tier dwell cascade (sub-timer 96, tier 16).
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { SEQUENCE_STATE, loc_4008, loc_4009 } from "./names.js";

export function postCreditAndMessageDrawsAndAdvance(m) {
  const { mem8 } = m;

  enqueueCommandWord(m, (7 << 8) | 1);
  enqueueCommandWord(m, 6 << 8);

  mem8[SEQUENCE_STATE]++;
  mem8[loc_4008] = 96; // dwell sub-timer
  mem8[loc_4009] = 16; // dwell tier
}
