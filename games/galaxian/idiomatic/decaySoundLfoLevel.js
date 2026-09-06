// SPDX-License-Identifier: GPL-3.0-only
// Per-frame LFO decay step: only on the 0xff tick with a nonzero level, drop the level by
// one and broadcast the new value across the LFO frequency latches.
import { broadcastSoundLfoLevel } from "./broadcastSoundLfoLevel.js";
import { FRAME_COUNTER, SOUND_LFO_LEVEL } from "./names.js";

export function decaySoundLfoLevel(m) {
  const { mem8 } = m;

  // Armed only on the 0xff tick; idle otherwise.
  if (mem8[FRAME_COUNTER] !== 0xff) return;

  const level = mem8[SOUND_LFO_LEVEL];
  if (level === 0) return; // already floored

  broadcastSoundLfoLevel(m, level - 1);
}
