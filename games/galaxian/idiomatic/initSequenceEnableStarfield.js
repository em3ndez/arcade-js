// SPDX-License-Identifier: GPL-3.0-only

/**
 * initSequenceEnableStarfield — sub-state-0 setup of the attract/sequence state machine.
 *
 * WHAT IT IS
 *   The opening sub-state of the top-level attract sequence. It queues two setup command words, switches
 *   the hardware starfield on, zeroes the per-sequence bookkeeping cells, and seeds the two-tier dwell
 *   cascade so the sequence will hold this step for a beat before walking itself forward.
 *
 * ROLE IN THE MACHINE
 *   Dispatched off SEQUENCE_STATE by runAttractSequenceAndAdvanceOnCredit as its first sub-state. The
 *   starfield it lights (STARS_ENABLE 0x7004) is the scrolling backdrop of the attract screen. Advancing
 *   SEQUENCE_STATE (0x400a) at the end steps to the next sub-state; the dwell cascade (fast sub-timer
 *   loc_4008, dwell tier loc_4009) gates that walk. Resets CURRENT_PLAYER (0x400d), loc_400e, loc_4006,
 *   loc_4019 and sets loc_4007.
 *
 * ROM 0x018c.  Grounding: [seen].
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4007, STARS_ENABLE, SEQUENCE_STATE,
  loc_4019, CURRENT_PLAYER, loc_400e, loc_4006, loc_4008, loc_4009,
} from "./names.js";

export function initSequenceEnableStarfield(m) {
  const { mem8 } = m;

  // Post two setup cues to the command queue. Command words are (channel << 8) | param pairs the
  // display-list drain later dispatches: channel 7 param 1, then channel 6 param 0.
  enqueueCommandWord(m, (7 << 8) | 1);
  enqueueCommandWord(m, 6 << 8);

  // Turn the starfield on and raise loc_4007. The hardware STARS_ENABLE latch lights the scrolling stars
  // that back the attract screen.
  mem8[loc_4007] = 1;
  mem8[STARS_ENABLE] = 1;   // starfield on (two adjacent unmapped control latches are strobed too -- dropped)

  mem8[SEQUENCE_STATE]++;   // advance the sub-state index

  // Clear the per-sequence bookkeeping so the fresh sequence starts from a known state (loc_4019 one-shot
  // per-step cell, CURRENT_PLAYER back to player 0, loc_400e, and the loc_4006 mode/game-over gate), then
  // seed the dwell cascade (fast sub-timer loc_4008, dwell tier loc_4009) that holds this step before it steps.
  mem8[loc_4019] = 0;
  mem8[CURRENT_PLAYER] = 0;
  mem8[loc_400e] = 0;
  mem8[loc_4006] = 0;
  mem8[loc_4008] = 96;      // dwell sub-timer
  mem8[loc_4009] = 16;      // dwell tier
}
