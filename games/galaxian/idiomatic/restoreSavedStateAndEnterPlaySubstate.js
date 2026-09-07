// SPDX-License-Identifier: GPL-3.0-only
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  SAVED_STATE_SNAPSHOT,
  loc_4218,
  FRAME_COUNTER,
  loc_4220,
  loc_400f,
  loc_4018,
  FLIP_SCREEN_X,
  FLIP_SCREEN_Y,
  SEQUENCE_STATE,
  loc_4009,
  loc_4245,
  loc_4006,
  loc_0830,
  loc_0503,
  loc_0603,
  loc_0604,
  loc_0703,
  loc_0700,
} from "./names.js";

/**
 * restoreSavedStateAndEnterPlaySubstate (ROM 0x0795) -- player two's "restore the board" step, sub-state 2
 * of runPlayerTwoPlayFrame, the mirror of player one's restoreFormationAndEnterPlaySubstate.
 *
 * WHAT IT IS
 *   In a two-player game the two phases keep separate boards so each player resumes exactly the field they
 *   left. Sub-state 2 of the play sequence is where the board is rebuilt; player two's copy (this routine)
 *   restores from the SAVED_STATE_SNAPSHOT buffer rather than PACKED_FLAG_BITMAP. It expands that packed
 *   16-byte bitmask back into the 128-byte flag block, copies the trailing 8-byte board template into the
 *   working buffer, clears two status cells, and -- when the saved flip flag is set -- mirrors it into the
 *   display-flip latches. Then it advances the sub-state, arms the state timer, publishes the sub-state
 *   pointer, and (sound gate permitting) enqueues the round's five intro command words. See mechanisms.md
 *   "The play frames and their sub-states" and "The formation flag block and its occupancy summaries".
 *
 * ROLE IN THE MACHINE
 *   Reached from runPlayerTwoPlayFrame at SEQUENCE_STATE = 2. unpackBitmaskToFlagBytes expands
 *   SAVED_STATE_SNAPSHOT (0x41a0) into the flag block and returns a pointer on the trailing template, whose
 *   8 bytes are copied into loc_4218 (0x4218). Zeroes FRAME_COUNTER (0x425f) and loc_4220. Reads the saved
 *   flip flag loc_400f (0x400f); if nonzero it mirrors that value into the direction/flip working cell
 *   loc_4018 and the hardware latches FLIP_SCREEN_X (0x7006) / FLIP_SCREEN_Y (0x7007). Advances
 *   SEQUENCE_STATE (0x400a), arms state timer loc_4009 (0x4009) to 150, and publishes the sub-state pointer
 *   loc_0830 into loc_4245 (0x4245). When the sound gate loc_4006 (0x4006) bit 0 is open it enqueues five
 *   command words spanning channels 5/6/7.
 *
 * Grounding: [seen] (names.js cert for 0x0795).
 *
 * LIVE-OUT: flag block rebuilt, template copied, status cells cleared, flip latches mirrored when set,
 *   sub-state advanced, state timer armed, sub-state pointer published, and (gated) five command words queued.
 */
const TEMPLATE_BYTES = 8;
const STATE_TIMER_RELOAD = 150;

export function restoreSavedStateAndEnterPlaySubstate(m) {
  const { mem8, mem16 } = m;

  // Expand the saved bitmask into the flag block; the returned pointer sits on the 8-byte template.
  // Copy those template bytes into the working board buffer loc_4218 for the field build-up to read.
  const template = unpackBitmaskToFlagBytes(m, SAVED_STATE_SNAPSHOT);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[loc_4218 + i] = mem8[template + i];

  // Clear the frame counter and the loc_4220 status cell so the restored round starts fresh.
  mem8[FRAME_COUNTER] = 0;
  mem8[loc_4220] = 0;

  // Restore the saved display flip: if the snapshot's flip flag (loc_400f) is set, mirror it into the
  // direction/flip working cell (loc_4018) and both hardware flip latches so the screen orientation the
  // player left is re-applied; when it is zero, leave the current (unflipped) orientation untouched.
  const flip = mem8[loc_400f];
  if (flip !== 0) {
    mem8[loc_4018] = flip;
    mem8[FLIP_SCREEN_X] = flip;
    mem8[FLIP_SCREEN_Y] = flip;
  }

  // Advance to the next sub-state, arm the 150-tick state timer that holds this step, and publish the
  // sub-state pointer loc_0830 into loc_4245 for the dispatcher to vector to later.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // advance sub-state
  mem8[loc_4009] = STATE_TIMER_RELOAD;             // arm the state timer
  mem16[loc_4245] = loc_0830;                      // publish the sub-state pointer

  // Sound tail: nothing to post unless the sound driver is enabled (loc_4006 bit 0).
  if ((mem8[loc_4006] & 1) === 0) return; // sound gate closed

  // Enqueue the five intro command words: each is a (channel<<8 | param) word -- (5,3),(6,3),(6,4),(7,3),
  // (7,0) across channels 5/6/7 -- deferred through the command queue. The second argument (loc_0830) is
  // the caller's HL that enqueueCommandWord preserves and restores, here the just-published sub-state pointer.
  enqueueCommandWord(m, loc_0503, loc_0830);
  enqueueCommandWord(m, loc_0603, loc_0830);
  enqueueCommandWord(m, loc_0604, loc_0830);
  enqueueCommandWord(m, loc_0703, loc_0830);
  return enqueueCommandWord(m, loc_0700, loc_0830);
}
