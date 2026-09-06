// SPDX-License-Identifier: GPL-3.0-only
// Stage a sound pitch keyed on the low two bits at the pointer. If they are nonzero, recompute the pitch
// from the sound counter using those bits as the selector; otherwise stage a fixed pitch of 96.
import { stagePitchFromSoundCounter } from "./stagePitchFromSoundCounter.js";
import { stageSoundPitch } from "./stageSoundPitch.js";

export function stageSoundPitchBySelector(m, cell = m.regs.hl) {
  const selector = m.mem8[cell] & 0x03;
  if (selector !== 0) return stagePitchFromSoundCounter(m, selector);
  return stageSoundPitch(m, 96);
}
