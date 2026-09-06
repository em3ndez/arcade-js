// SPDX-License-Identifier: GPL-3.0-only
// Sub-state 0 setup: queue two setup command words, enable the starfield, advance the sub-state index,
// clear the sub-state work cells, and seed the dwell cascade (sub-timer, tier).
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4007, STARS_ENABLE, SEQUENCE_STATE,
  loc_4019, CURRENT_PLAYER, loc_400e, loc_4006, loc_4008, loc_4009,
} from "./names.js";

export function initSequenceEnableStarfield(m) {
  const { mem8 } = m;

  // Command words are [channel, param] pairs appended to the command queue.
  enqueueCommandWord(m, (7 << 8) | 1);
  enqueueCommandWord(m, 6 << 8);

  mem8[loc_4007] = 1;
  mem8[STARS_ENABLE] = 1;   // starfield on (two adjacent unmapped control latches are strobed too -- dropped)

  mem8[SEQUENCE_STATE]++;   // advance the sub-state index

  mem8[loc_4019] = 0;
  mem8[CURRENT_PLAYER] = 0;
  mem8[loc_400e] = 0;
  mem8[loc_4006] = 0;
  mem8[loc_4008] = 96;      // dwell sub-timer
  mem8[loc_4009] = 16;      // dwell tier
}
