// SPDX-License-Identifier: GPL-3.0-only
// Dispatch the LFO frequency updater. With no reset request pending, run the normal per-frame decay.
// Otherwise consume the request and slam the full level across the LFO frequency latches.
import { decaySoundLfoLevel } from "./decaySoundLfoLevel.js";
import { broadcastSoundLfoLevel } from "./broadcastSoundLfoLevel.js";
import { SOUND_LFO_RESET_REQUEST } from "./names.js";

const FULL_LEVEL = 15;

export function loc_1898(m) {
  const { mem8 } = m;

  if (mem8[SOUND_LFO_RESET_REQUEST] === 0) return decaySoundLfoLevel(m);

  mem8[SOUND_LFO_RESET_REQUEST] = 0;
  return broadcastSoundLfoLevel(m, FULL_LEVEL);
}
