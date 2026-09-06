// SPDX-License-Identifier: GPL-3.0-only
// Sub-state handler: expand the saved bitmask into the flag block, copy the 8-byte template that follows
// it into the template buffer, and clear two status bytes; when the flip flag is set, mirror it to the
// display-flip latches. Then advance the sub-state, arm the state timer, publish the sub-state pointer,
// and — while the sound gate is open — enqueue five command words.
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

const TEMPLATE_BYTES = 8;
const STATE_TIMER_RELOAD = 150;

export function restoreSavedStateAndEnterPlaySubstate(m) {
  const { mem8, mem16 } = m;

  // Expand the saved bitmask into the flag block; the returned pointer sits on the 8-byte template.
  const template = unpackBitmaskToFlagBytes(m, SAVED_STATE_SNAPSHOT);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[loc_4218 + i] = mem8[template + i];

  mem8[FRAME_COUNTER] = 0;
  mem8[loc_4220] = 0;

  const flip = mem8[loc_400f];
  if (flip !== 0) {
    mem8[loc_4018] = flip;
    mem8[FLIP_SCREEN_X] = flip;
    mem8[FLIP_SCREEN_Y] = flip;
  }

  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // advance sub-state
  mem8[loc_4009] = STATE_TIMER_RELOAD;             // arm the state timer
  mem16[loc_4245] = loc_0830;                      // publish the sub-state pointer

  if ((mem8[loc_4006] & 1) === 0) return; // sound gate closed

  enqueueCommandWord(m, loc_0503, loc_0830);
  enqueueCommandWord(m, loc_0603, loc_0830);
  enqueueCommandWord(m, loc_0604, loc_0830);
  enqueueCommandWord(m, loc_0703, loc_0830);
  return enqueueCommandWord(m, loc_0700, loc_0830);
}
