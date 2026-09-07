// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSoundFrame — the sound driver's per-frame tick.
 *
 * WHAT IT IS
 *   The heart of Galaxian's audio system: one call per frame that composes every discrete-sound voice
 *   for this frame into two RAM shadows and then latches the result to the sound board.
 *
 * ROLE IN THE MACHINE
 *   Run from the per-frame audio-and-input service driveSoundFrameAndScanInput (0x1c3a). The driver opens
 *   each frame from a clean slate, then runs seven voice/effect updaters in a FIXED ROM order. Every
 *   updater may leave its mark on the two shadows: the composite flag byte loc_41c0 (a per-frame
 *   "which voice spoke" summary — sequence channels stamp it 2, the pulse envelope stamps it 1, the pitch
 *   ramp clears it to 0) and the staged-pitch shadow SOUND_PITCH (0x41c1). Because the updaters run in
 *   order and the pitch shadow is a single cell, the LAST updater to touch SOUND_PITCH is the voice that
 *   is actually heard — the ordering is what arbitrates between competing voices.
 *
 * ROM 0x16f5.  Grounding: [seen].
 *
 * LIVE-OUT: SOUND_W_REG6/REG7 (0x6806/0x6807) and the pitch latch SOUND_PITCH_W (0x7800) written to the
 *   sound hardware; loc_41c0 and SOUND_PITCH left holding this frame's composed values.
 */
import { loc_41c0, SOUND_PITCH, SOUND_W_REG6, SOUND_W_REG7, SOUND_PITCH_W } from "./names.js";
import { armSoundSequenceOnRequest } from "./armSoundSequenceOnRequest.js";
import { updateSoundSweepVoice } from "./updateSoundSweepVoice.js";
import { armSoundSequenceBySelector } from "./armSoundSequenceBySelector.js";
import { advanceAllSoundSequenceChannels } from "./advanceAllSoundSequenceChannels.js";
import { advancePulseToneEnvelope } from "./advancePulseToneEnvelope.js";
import { driveRisingPitchRamp } from "./driveRisingPitchRamp.js";
import { advanceGatedSquareTone } from "./advanceGatedSquareTone.js";

export function driveSoundFrame(m) {
  const { mem8 } = m;

  // Clean slate for the frame: clear the composite flag byte (nothing has "spoken" yet) and prime the
  // staged-pitch shadow high (0xFF) so an updater that writes a lower pitch wins by being written last.
  mem8[loc_41c0] = 0;
  mem8[SOUND_PITCH] = 0xff;

  // The seven voice/effect updaters, in the fixed ROM order. Order is load-bearing: it decides which
  // voice's pitch survives into SOUND_PITCH and how the composite byte ends up stamped this frame.
  //   1. arm a melodic sequence channel if one was requested (loc_41d1 gate)
  armSoundSequenceOnRequest(m);
  //   2. the pitch-sweep voice (gated on the sound-enable bit)
  updateSoundSweepVoice(m);
  //   3. arm a melodic sequence channel from the shared request selector loc_41df
  armSoundSequenceBySelector(m);
  //   4. advance the three melodic sequence channels one tick
  advanceAllSoundSequenceChannels(m);
  //   5. the pulse-tone envelope (a decrementing two-byte envelope word)
  advancePulseToneEnvelope(m);
  //   6. the rising pitch ramp / glide (armed by player input via loc_41c9)
  driveRisingPitchRamp(m);
  //   7. the gated square-wave tone
  advanceGatedSquareTone(m);

  // Latch the composed bytes out to the discrete-sound hardware. The composite byte goes to register 6;
  // a rotate-right of the same byte (bit 0 wrapping up into bit 7) goes to register 7; and the staged
  // pitch shadow is copied to the pitch latch at 0x7800.
  const composite = mem8[loc_41c0];
  mem8[SOUND_W_REG6] = composite;
  mem8[SOUND_W_REG7] = (composite >> 1) | ((composite & 1) << 7); // rotate-right of the composite
  mem8[SOUND_PITCH_W] = mem8[SOUND_PITCH];
}
