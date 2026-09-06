// SPDX-License-Identifier: GPL-3.0-only
// Sound-cue prologue: enqueue one command word on the cue channel, then post the standard five-word burst
// for that same channel.
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { enqueueCommandWordBurst } from "./enqueueCommandWordBurst.js";

const CHANNEL = 5;          // sound channel carried through the whole cue set
const PROLOGUE_PARAM = 3;   // the prologue word is (channel << 8) | param

export function queueBoardStartSoundBurst(m) {
  enqueueCommandWord(m, (CHANNEL << 8) | PROLOGUE_PARAM);
  return enqueueCommandWordBurst(m, CHANNEL);
}
