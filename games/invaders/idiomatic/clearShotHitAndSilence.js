// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_HIT } from "./names.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

/**
 * clearShotHitAndSilence — reset the player-shot collision latch and stop the invader-die tone.
 *
 * WHAT IT IS
 *   The base step of the player shot's collision teardown. It clears the shot-collision latch and turns
 *   off the sound that plays when a shot destroys an invader, leaving nothing ringing once the shot is
 *   done resolving.
 *
 * ROLE IN THE MACHINE
 *   PLAYER_SHOT_HIT (0x2002) is the collision latch: the object processor copies COLLISION_FLAG into it
 *   after a shot is drawn (mechanisms.md, player-shot collision lifecycle). Clearing it re-arms the
 *   detector for the next shot. The invader-die cue is port-3 bit 3, so clearSoundPort3Bit(0xf7) ANDs
 *   0xf7 (~0x08) into the port-3 sound shadow SOUND_PORT3_SHADOW (0x2094) and mirrors it out, silencing
 *   only that cue. This routine is the tail of retirePlayerShot (which first sets PLAYER_SHOT_STATUS to 4),
 *   and is reached directly by resolvePlayerShotHit when a shot misses off the top of the screen.
 *
 * ROM 0x154a-....  Grounding: [seen].
 *
 * LIVE-OUT: A = the resulting port-3 shadow byte (from clearSoundPort3Bit).
 */
export function clearShotHitAndSilence(m) {
  // Re-arm the collision detector: drop the shot-hit latch so the next shot starts from a clean state.
  m.mem8[PLAYER_SHOT_HIT] = 0;
  // Silence the invader-die cue: mask bit 3 (0xf7 = ~0x08) off the shared port-3 sound shadow and mirror
  // the byte out to sound port 3; every other cue's bit is left untouched.
  return clearSoundPort3Bit(m, 0xf7);
}
