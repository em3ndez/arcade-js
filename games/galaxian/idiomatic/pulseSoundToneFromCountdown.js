// SPDX-License-Identifier: GPL-3.0-only
/**
 * pulseSoundToneFromCountdown -- the high-byte half of the pulse-tone sound envelope: tick the
 * envelope down one and stage a bit-gated two-level pulse into the sound output shadow.
 *
 * WHAT IT IS
 *   The pulse-tone voice is driven by a two-byte decrementing envelope word (low byte 0x41c7, high byte
 *   loc_41c8). Each frame advancePulseToneEnvelope hands this routine the current high byte. If the
 *   envelope has run out (high byte zero) it stays silent; otherwise it decrements the high byte and
 *   emits one of two levels depending on a single bit of the counter, producing the square-ish pulse.
 *
 * ROLE IN THE MACHINE
 *   Called from advancePulseToneEnvelope (0x184f), the per-frame sound-driver slot for this voice.
 *   The two output levels are staged via stagePitchAndRaiseSoundFlag, which writes (value - 1) mod 256
 *   to SOUND_PITCH (fed to the 0x7800 pitch latch) and raises the sound flag so the pair is picked up
 *   this frame. Passing 129 yields pitch 128; passing 0 yields pitch 255 -- the two levels of the pulse.
 *
 * ROM 0x185e.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: loc_41c8 (envelope high byte) decremented, and the sound output shadow staged via the
 *   helper's return. The high-byte-zero path returns without touching anything.
 */
import { stagePitchAndRaiseSoundFlag } from "./stagePitchAndRaiseSoundFlag.js";
import { loc_41c8 } from "./names.js";

export function pulseSoundToneFromCountdown(m, high = m.regs.h) {
  const { mem8 } = m;
  // Envelope exhausted: high byte zero means the pulse has run its course, so emit nothing this frame.
  if (high === 0) return;

  // Tick the envelope down one step and write it back as the word's high byte.
  const stored = high - 1;
  mem8[loc_41c8] = stored;

  // Gate the pulse level on bit 2 of the decremented counter: set -> stage 129, clear -> stage 0. This
  // toggling as the counter counts down is what gives the voice its two-level square-pulse shape.
  return stagePitchAndRaiseSoundFlag(m, (stored & 0x04) ? 129 : 0);
}
