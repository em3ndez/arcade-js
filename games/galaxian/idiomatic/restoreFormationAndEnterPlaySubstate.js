// SPDX-License-Identifier: GPL-3.0-only
// Board/level-start setup (dispatch-table target): unpack the packed flag bitmap into the flag block, copy
// the 8-byte template that follows it into the template buffer, clear the status/flip/direction cells,
// advance the sequence state, arm the dwell timer, and publish a deferred-callback pointer. Then, only when
// the sound gate is open, post the board-start cue: the paired-player burst when the paired-player flag is
// set, else a plain channel-5 prologue word plus the standard burst.
import {
  PACKED_FLAG_BITMAP, loc_4218, FRAME_COUNTER, loc_4220, FLIP_SCREEN_X, FLIP_SCREEN_Y,
  loc_4018, SEQUENCE_STATE, loc_4009, loc_4245, loc_0640, loc_4006, loc_400e,
} from "./names.js";
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import { queueBoardStartSoundBurst } from "./queueBoardStartSoundBurst.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { enqueueCommandWordBurst } from "./enqueueCommandWordBurst.js";

const TEMPLATE_BYTES = 8;
const DWELL_RELOAD = 150;
const CHANNEL = 5; // board-start sound cue channel

export function restoreFormationAndEnterPlaySubstate(m) {
  const { mem8, mem16 } = m;

  // Unpack the packed bitmap into the flag block; the returned pointer sits on the trailing template.
  const template = unpackBitmaskToFlagBytes(m, PACKED_FLAG_BITMAP);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[loc_4218 + i] = mem8[template + i];

  mem8[FRAME_COUNTER] = 0;
  mem8[loc_4220] = 0;
  mem8[FLIP_SCREEN_X] = 0;
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4009] = DWELL_RELOAD;
  mem16[loc_4245] = loc_0640;

  if ((mem8[loc_4006] & 1) === 0) return;                       // sound gate closed
  if (mem8[loc_400e] & 1) return queueBoardStartSoundBurst(m);  // paired-player variant

  enqueueCommandWord(m, CHANNEL << 8); // prologue word: channel 5, param 0
  return enqueueCommandWordBurst(m, CHANNEL);
}
