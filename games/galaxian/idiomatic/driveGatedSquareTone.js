// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveGatedSquareTone (ROM 0x1733) -- the toggler half of the gated square-wave voice.
 *
 * WHAT IT IS
 *   One tick of a gated square-wave tone. While the tone's duration counter is non-zero it counts one
 *   tick off the duration and drives sound write register 5 with the frame flag's bit 0 flipped -- a bit
 *   that alternates from frame to frame, so the register squares up into an audible tone. Once the
 *   duration is spent it writes 0 to silence the register.
 *
 * ROLE IN THE MACHINE
 *   The gated square-wave voice is two routines (mechanisms.md "The gated square-wave tone"):
 *   advanceGatedSquareTone (0x1723) runs the phase counter loc_41cc and calls this toggler each tick while
 *   the voice is armed, re-arming the duration to 8 at the expiry step; this routine does the per-tick
 *   toggle-and-silence. Reads the tone duration SOUND_TONE_DURATION (0x41ce) and the frame flag loc_4007
 *   (0x4007, whose bit 0 alternates per frame). Writes the discrete-sound register SOUND_W_REG5 (0x6805).
 *
 * Grounding: [seen] (names.js cert for 0x1733).
 *
 * LIVE-OUT: none returned; the effect is SOUND_W_REG5 (0x6805) driven with the toggled tone level, or 0
 *   when the duration has run out, and the decremented SOUND_TONE_DURATION.
 */
import { SOUND_TONE_DURATION, loc_4007, SOUND_W_REG5 } from "./names.js";

export function driveGatedSquareTone(m) {
  const { mem8 } = m;

  // Default output is silence — written when the duration has run out.
  let level = 0;

  // Only sound while the tone still has duration left. SOUND_TONE_DURATION is the remaining tone length,
  // re-armed to 8 by advanceGatedSquareTone at its expiry step.
  const remaining = mem8[SOUND_TONE_DURATION];
  if (remaining !== 0) {
    // Still playing: count one tick off the duration (byte store wraps mod 256).
    mem8[SOUND_TONE_DURATION] = remaining - 1;

    // Tone level = frame flag with bit 0 flipped; that bit alternates per frame, so this toggles output.
    level = mem8[loc_4007] ^ 0x01;
  }

  // Drive the level (toggled tone, or 0 when spent) to the sound register.
  mem8[SOUND_W_REG5] = level;
}
