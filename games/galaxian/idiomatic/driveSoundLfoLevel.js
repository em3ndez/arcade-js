// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSoundLfoLevel — the per-frame LFO-level driver.
 *
 * WHAT IT IS
 *   Maintains the low-frequency-modulation "level" that is layered over the frequency of the
 *   discrete-sound voices, dispatching each frame between a slow decay and a full-level reset.
 *
 * ROLE IN THE MACHINE
 *   Called from the VBLANK-NMI service (loc_0066). It reads the reset-request flag
 *   SOUND_LFO_RESET_REQUEST (0x41d0): with no request pending it runs the ordinary per-frame decay
 *   (decaySoundLfoLevel — which itself only steps on the tick where the frame counter reads 0xff, so the
 *   fade is deliberately slow). When a reset IS requested it consumes the request (clearing the flag) and
 *   slams the full level of 15 across the four LFO frequency latches via broadcastSoundLfoLevel, which
 *   saves the level and fans it out to the latches, rotating the byte right one bit between each write.
 *
 * ROM 0x1898.  Grounding: [seen].
 *
 * LIVE-OUT: SOUND_LFO_RESET_REQUEST cleared on the reset path; SOUND_LFO_LEVEL and the four LFO frequency
 *   latches updated by whichever branch ran.
 */
import { decaySoundLfoLevel } from "./decaySoundLfoLevel.js";
import { broadcastSoundLfoLevel } from "./broadcastSoundLfoLevel.js";
import { SOUND_LFO_RESET_REQUEST } from "./names.js";

// level slammed across the LFO frequency latches on a reset request
const FULL_LEVEL = 15;

export function driveSoundLfoLevel(m) {
  const { mem8 } = m;

  // No reset pending: run the ordinary slow per-frame decay and return its result.
  if (mem8[SOUND_LFO_RESET_REQUEST] === 0) return decaySoundLfoLevel(m);

  // A reset was requested: consume the one-shot request flag, then broadcast the full level to every
  // LFO frequency latch.
  mem8[SOUND_LFO_RESET_REQUEST] = 0;
  return broadcastSoundLfoLevel(m, FULL_LEVEL);
}
