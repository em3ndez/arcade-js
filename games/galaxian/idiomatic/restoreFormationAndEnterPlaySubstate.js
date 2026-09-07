// SPDX-License-Identifier: GPL-3.0-only
import {
  PACKED_FLAG_BITMAP, loc_4218, FRAME_COUNTER, loc_4220, FLIP_SCREEN_X, FLIP_SCREEN_Y,
  loc_4018, SEQUENCE_STATE, loc_4009, loc_4245, loc_0640, loc_4006, loc_400e,
} from "./names.js";
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import { queueBoardStartSoundBurst } from "./queueBoardStartSoundBurst.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { enqueueCommandWordBurst } from "./enqueueCommandWordBurst.js";

/**
 * restoreFormationAndEnterPlaySubstate (ROM 0x05a5) -- player one's "restore the board" step, sub-state 2
 * of the play sequence, where the standing formation is rebuilt and the round's opening cue is posted.
 *
 * WHAT IT IS
 *   Play runs as an eight-sub-state sequence dispatched on SEQUENCE_STATE. Sub-state 2 differs between the
 *   two player phases: player one restores its board from PACKED_FLAG_BITMAP (this routine), player two
 *   from SAVED_STATE_SNAPSHOT (restoreSavedStateAndEnterPlaySubstate). This routine unpacks that packed
 *   16-byte bitmap back into the 128-byte flag block (one live-alien bit per cell), copies the 8-byte
 *   board template that trails the packed bits into the working buffer, clears the frame/status/flip/
 *   direction cells, advances the sub-state, arms a long dwell, and publishes a deferred-callback pointer.
 *   Then -- only if the sound gate is open -- it cues the board-start sound. See mechanisms.md "The play
 *   frames and their sub-states" and "The formation flag block and its occupancy summaries".
 *
 * ROLE IN THE MACHINE
 *   Reached from runPlayerOnePlayFrame at SEQUENCE_STATE = 2. unpackBitmaskToFlagBytes expands
 *   PACKED_FLAG_BITMAP (0x4180) into the flag block and returns a pointer sitting on the trailing template,
 *   whose 8 bytes are copied into loc_4218 (0x4218). Zeroes FRAME_COUNTER (0x425f), loc_4220, FLIP_SCREEN_X
 *   (0x7006), FLIP_SCREEN_Y (0x7007), and loc_4018 (the direction/flip working cell); advances
 *   SEQUENCE_STATE (0x400a); arms dwell timer loc_4009 (0x4009) to 150; stores the deferred-callback
 *   pointer loc_0640 into loc_4245 (0x4245). The sound tail is gated on loc_4006 (0x4006) bit 0; the
 *   paired-player flag loc_400e (0x400e) bit 0 selects queueBoardStartSoundBurst over the plain burst.
 *
 * Grounding: [seen] (names.js cert for 0x05a5).
 *
 * LIVE-OUT: flag block rebuilt, template copied, status/flip cells cleared, sub-state advanced, dwell
 *   armed, callback pointer published, and (gated) a board-start sound burst enqueued.
 */
const TEMPLATE_BYTES = 8;
const DWELL_RELOAD = 150;
const CHANNEL = 5; // board-start sound cue channel

export function restoreFormationAndEnterPlaySubstate(m) {
  const { mem8, mem16 } = m;

  // Unpack the packed bitmap into the flag block; the returned pointer sits on the trailing template.
  // Copy those 8 template bytes into the working board buffer loc_4218 that the field build-up reads.
  const template = unpackBitmaskToFlagBytes(m, PACKED_FLAG_BITMAP);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[loc_4218 + i] = mem8[template + i];

  // Clear per-round state: zero the frame counter and the loc_4220 status cell, then the two hardware
  // screen-flip latches (X/Y) and the loc_4018 direction/flip working cell so the round starts unflipped.
  mem8[FRAME_COUNTER] = 0;
  mem8[loc_4220] = 0;
  mem8[FLIP_SCREEN_X] = 0;
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;
  // Advance to the next sub-state, arm the 150-tick dwell that holds this step, and publish the
  // deferred-callback pointer loc_0640 into loc_4245 for the dispatcher to vector to later.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4009] = DWELL_RELOAD;
  mem16[loc_4245] = loc_0640;

  // Sound tail, gated on the sound driver being enabled (loc_4006 bit 0). If the paired-player flag
  // (loc_400e bit 0) is set, post the paired-player board-start variant; otherwise post the plain cue.
  if ((mem8[loc_4006] & 1) === 0) return;                       // sound gate closed
  if (mem8[loc_400e] & 1) return queueBoardStartSoundBurst(m);  // paired-player variant

  // Plain board-start cue: a prologue command word (channel 5, param 0) then the standard five-word burst
  // that spans channels 5/6/7 -- deferred through the command queue rather than touching sound inline.
  enqueueCommandWord(m, CHANNEL << 8); // prologue word: channel 5, param 0
  return enqueueCommandWordBurst(m, CHANNEL);
}
