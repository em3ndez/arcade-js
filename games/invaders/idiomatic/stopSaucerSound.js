// SPDX-License-Identifier: GPL-3.0-only
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

/**
 * stopSaucerSound -- silence the flying saucer's continuous whine.
 *
 * WHAT IT IS
 *   The saucer's ongoing UFO tone is a single port-3 discrete-sound bit (bit 0). This routine turns that
 *   bit off, ending the whine.
 *
 * ROLE IN THE MACHINE
 *   Port 3 carries several independent one-shot cues sharing one latch, so the game never rebuilds the port
 *   byte from scratch: clearSoundPort3Bit ANDs the mask into the RAM shadow SOUND_PORT3_SHADOW (0x2094),
 *   stores it back, and mirrors it out to sound port 3 -- clearing only bit 0 (mask 0xfe) and leaving every
 *   other cue as it stands. Called by the per-frame saucer sound gate updateSaucerSound whenever
 *   SAUCER_ACTIVE (0x2084) is clear.
 *
 * ROM 0x0707.  Grounding: [seen].
 *
 * LIVE-OUT: A = the resulting shadow byte (from clearSoundPort3Bit).
 */
export function stopSaucerSound(m) {
  // Clear the saucer whine's bit (mask 0xfe) through the shared port-3 shadow helper.
  return clearSoundPort3Bit(m, 0xfe);
}
