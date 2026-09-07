// SPDX-License-Identifier: GPL-3.0-only
/**
 * queueBoardStartSoundBurst -- the board/level-start sound cue: queue a one-word prologue then the
 * standard five-word sound burst, all on the level-start channel set.
 *
 * WHAT IT IS
 *   When a round begins, the machine plays a short fanfare. Rather than touch the sound hardware
 *   inline, this routine posts the cue as command words: a single prologue word followed by the shared
 *   five-word burst. A later per-frame consumer drains the queue and drives the sound hardware.
 *
 * ROLE IN THE MACHINE
 *   The sole caller is restoreFormationAndEnterPlaySubstate (the player-one "restore the board" play
 *   sub-state), and only when the sound/mode gate loc_4006 bit 0 and the paired-player flag loc_400e
 *   bit 0 are both set -- i.e. this is the paired-player board-start variant. Each command word is
 *   (channel << 8) | parameter; the prologue is channel 5 param 3, and enqueueCommandWordBurst then
 *   pushes the fixed five-word cue spanning channels 5/6/7.
 *
 * ROM 0x05fc.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: the command queue, extended by the prologue word plus the burst. Returns the burst helper's
 *   result (the restored saved pointer); no memory result the caller inspects.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { enqueueCommandWordBurst } from "./enqueueCommandWordBurst.js";

const CHANNEL = 5;          // sound channel carried through the whole cue set
const PROLOGUE_PARAM = 3;   // the prologue word is (channel << 8) | param

export function queueBoardStartSoundBurst(m) {
  // Prologue: one command word (channel 5, param 3) that leads the cue.
  enqueueCommandWord(m, (CHANNEL << 8) | PROLOGUE_PARAM);
  // Body: the shared five-word sound burst starting from this same channel (5/6/7).
  return enqueueCommandWordBurst(m, CHANNEL);
}
