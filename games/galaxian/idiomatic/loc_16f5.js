// SPDX-License-Identifier: GPL-3.0-only
// loc_16f5 — the sound driver's per-frame tick. Start the frame's sound composition from a clean slate (the
// composite flag byte cleared, the pitch shadow primed high), run the seven channel/effect updaters that
// compose this frame's sound into those shadows, then latch the composed bytes to the sound hardware: the
// composite -> sound register 6, its rotate-right -> register 7, and the staged pitch -> the pitch latch.
import { loc_41c0, SOUND_PITCH, SOUND_W_REG6, SOUND_W_REG7, SOUND_PITCH_W } from "./names.js";
import { armSoundSequenceOnRequest } from "./armSoundSequenceOnRequest.js";
import { updateSoundSweepVoice } from "./updateSoundSweepVoice.js";
import { armSoundSequenceBySelector } from "./armSoundSequenceBySelector.js";
import { advanceAllSoundSequenceChannels } from "./advanceAllSoundSequenceChannels.js";
import { advancePulseToneEnvelope } from "./advancePulseToneEnvelope.js";
import { driveRisingPitchRamp } from "./driveRisingPitchRamp.js";
import { advanceGatedSquareTone } from "./advanceGatedSquareTone.js";

export function loc_16f5(m) {
  const { mem8 } = m;

  // Clean slate: composite flag byte cleared, pitch shadow primed high (0xFF).
  mem8[loc_41c0] = 0;
  mem8[SOUND_PITCH] = 0xff;

  // The seven channel/effect updaters compose this frame's sound into the shadows above, in fixed order.
  armSoundSequenceOnRequest(m);
  updateSoundSweepVoice(m);
  armSoundSequenceBySelector(m);
  advanceAllSoundSequenceChannels(m);
  advancePulseToneEnvelope(m);
  driveRisingPitchRamp(m);
  advanceGatedSquareTone(m);

  // Latch the composed bytes to the sound hardware.
  const composite = mem8[loc_41c0];
  mem8[SOUND_W_REG6] = composite;
  mem8[SOUND_W_REG7] = (composite >> 1) | ((composite & 1) << 7); // rotate-right of the composite
  mem8[SOUND_PITCH_W] = mem8[SOUND_PITCH];
}
