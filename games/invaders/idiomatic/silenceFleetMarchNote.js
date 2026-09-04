// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT5_SHADOW } from "./names.js";

/**
 * silenceFleetMarchNote — end the current fleet-march "footstep" note.
 *
 * WHAT IT IS
 *   Turns off the four low tone bits of sound port 5, emitting only the two latched high bits. That cuts
 *   the fleet-march footstep tone while leaving the sound-select / saucer-hit latches (the high bits)
 *   ringing — which is what makes each march step a discrete note rather than a continuous drone.
 *
 * ROLE IN THE MACHINE
 *   Port 5 packs the fleet-march tones in its low nibble and two latched high bits (mask 0x30). This helper
 *   masks the port-5 shadow SOUND_PORT5_SHADOW (0x2098) with 0x30 and writes it out, so only those two high
 *   bits survive. It is the note-off helper the fleet-march metronome stepFleetMarchSound calls when the
 *   note timer expires and when the march is disabled (mechanisms.md, sound). It reads the shadow rather
 *   than an accumulator (its sibling latchSoundPort5 masks A instead).
 *
 * ROM 0x176d-....  Grounding: [seen].
 *
 * LIVE-OUT: sound port 5 written; no register result.
 */
export function silenceFleetMarchNote(m) {
  // Emit only the two latched high bits (mask 0x30) of the port-5 shadow: the march tone goes silent, the
  // sound-select / saucer-hit latches stay.
  m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW] & 0x30);
}
