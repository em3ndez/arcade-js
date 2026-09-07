// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueCommandWordBurst -- post a fixed five-word sound cue into the command queue in one call.
 *
 * WHAT IT IS
 *   A convenience producer for callers that need a whole sound-and-draw cue queued at once (board/level
 *   start and similar). It appends five command words through enqueueCommandWord, each word shaped as
 *   (channel << 8) | param -- a channel selector in the high byte, a parameter in the low byte.
 *
 * ROLE IN THE MACHINE
 *   The five words follow a fixed pattern relative to the caller's channel D: the first carries the
 *   caller's channel (param 2), the next two carry channel D+1 (params 2 then 4), and the final two are
 *   fixed cues on channel 7 (param 3 then 0). So the burst spans three consecutive channels D, D+1, and 7.
 *   It is the tail of restoreFormationAndEnterPlaySubstate (falls through after 0x0500) and is also
 *   entered from queueBoardStartSoundBurst, which prepends its own channel-5 prologue word before this
 *   burst so the cue spans channels 5, 6, and 7.
 *
 * ROM 0x05e2.  Grounding: [seen]. No direct memory of its own -- every effect is a delegated
 * enqueueCommandWord append; a full queue silently drops individual words.
 *
 * LIVE-OUT: whatever enqueueCommandWord leaves (the appended words plus m.regs.hl). Returns the result of
 * the last append.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function enqueueCommandWordBurst(m, channel = m.regs.d) {
  // Word 1: the caller's channel, param 2.
  enqueueCommandWord(m, (channel << 8) | 2);
  // Words 2-3: the next channel up (D+1), params 2 then 4 -- the paired mid cue.
  enqueueCommandWord(m, ((channel + 1) << 8) | 2);
  enqueueCommandWord(m, ((channel + 1) << 8) | 4);
  // Words 4-5: the two fixed tail cues on channel 7, params 3 then 0.
  enqueueCommandWord(m, (7 << 8) | 3);
  return enqueueCommandWord(m, 7 << 8);
}
